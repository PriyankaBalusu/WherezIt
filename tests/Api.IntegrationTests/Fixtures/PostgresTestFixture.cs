using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Testcontainers.PostgreSql;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests.Fixtures;

public class PostgresTestFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer? _postgresContainer;
    public string ConnectionString { get; private set; } = string.Empty;
    public bool IsDockerContainerUsed { get; private set; }

    public PostgresTestFixture()
    {
        // Try creating Testcontainers PostgreSQL container if Docker is available
        try
        {
            _postgresContainer = new PostgreSqlBuilder()
                .WithImage("postgres:16-alpine")
                .WithDatabase("wherezit_test")
                .WithUsername("wherezit")
                .WithPassword("wherezit_test_password")
                .Build();
        }
        catch
        {
            _postgresContainer = null;
        }
    }

    public async Task InitializeAsync()
    {
        var customConnStr = Environment.GetEnvironmentVariable("TEST_POSTGRES_CONNECTION_STRING");

        if (!string.IsNullOrEmpty(customConnStr))
        {
            ConnectionString = customConnStr;
            IsDockerContainerUsed = false;
        }
        else if (_postgresContainer != null)
        {
            try
            {
                await _postgresContainer.StartAsync();
                ConnectionString = _postgresContainer.GetConnectionString();
                IsDockerContainerUsed = true;
            }
            catch
            {
                // Fall back to local PostgreSQL on 5432 if Docker daemon is offline
                ConnectionString = "Host=localhost;Port=5432;Database=wherezit_test;Username=wherezit;Password=wherezit_dev_password";
                IsDockerContainerUsed = false;
            }
        }
        else
        {
            ConnectionString = "Host=localhost;Port=5432;Database=wherezit_test;Username=wherezit;Password=wherezit_dev_password";
            IsDockerContainerUsed = false;
        }

        // Apply migrations / ensure database is created if DB is accessible
        try
        {
            using var scope = Services.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
            await dbContext.Database.MigrateAsync();
        }
        catch
        {
            // If local DB server is offline during test run, tests assert appropriate failure handling
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            var descriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<WherezItDbContext>));

            if (descriptor != null)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<WherezItDbContext>(options =>
            {
                options.UseNpgsql(ConnectionString);
            });
        });
    }

    public override async ValueTask DisposeAsync()
    {
        if (_postgresContainer != null)
        {
            await _postgresContainer.DisposeAsync();
        }
        await base.DisposeAsync();
    }

    Task IAsyncLifetime.DisposeAsync() => DisposeAsync().AsTask();
}
