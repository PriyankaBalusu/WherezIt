using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace WherezIt.Infrastructure.Persistence;

public class WherezItDbContextFactory : IDesignTimeDbContextFactory<WherezItDbContext>
{
    public WherezItDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<WherezItDbContext>();
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__PostgreSQL")
            ?? Environment.GetEnvironmentVariable("ConnectionStrings:PostgreSQL");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:PostgreSQL is not configured. Set environment variable ConnectionStrings__PostgreSQL or configure dotnet user-secrets.");
        }

        optionsBuilder.UseNpgsql(connectionString);

        return new WherezItDbContext(optionsBuilder.Options);
    }
}
