using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("PostgreSQL");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "PostgreSQL connection string 'ConnectionStrings:PostgreSQL' is not configured.");
        }

        services.AddDbContext<WherezItDbContext>(options =>
        {
            options.UseNpgsql(connectionString);
        });

        services.AddHealthChecks()
            .AddDbContextCheck<WherezItDbContext>("postgresql");

        return services;
    }
}
