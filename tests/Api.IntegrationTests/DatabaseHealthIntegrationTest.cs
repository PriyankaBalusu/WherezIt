using System.Net;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class DatabaseHealthIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public DatabaseHealthIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task ProcessLiveness_Returns200OK_WithoutDatabaseDependency()
    {
        var client = _fixture.CreateClient();
        var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public void PostgresqlProvider_UsesNpgsqlProvider()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezIt.Infrastructure.Persistence.WherezItDbContext>();
        
        Assert.Equal("Npgsql.EntityFrameworkCore.PostgreSQL", dbContext.Database.ProviderName);
    }

    [Fact]
    public async Task HealthReady_ReturnsExpectedStatusCode_BasedOnDatabaseAvailability()
    {
        var client = _fixture.CreateClient();
        var response = await client.GetAsync("/health/ready");

        if (_fixture.IsDockerContainerUsed)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
        else
        {
            // When PostgreSQL backend is unreachable, readiness reports unhealthy (503 Service Unavailable)
            Assert.True(response.StatusCode == HttpStatusCode.ServiceUnavailable || response.StatusCode == HttpStatusCode.OK);
        }
    }
}
