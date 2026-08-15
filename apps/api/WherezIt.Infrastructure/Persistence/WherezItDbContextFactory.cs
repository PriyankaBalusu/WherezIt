using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace WherezIt.Infrastructure.Persistence;

public class WherezItDbContextFactory : IDesignTimeDbContextFactory<WherezItDbContext>
{
    public WherezItDbContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<WherezItDbContext>();
        var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__PostgreSQL")
            ?? "Host=localhost;Port=5432;Database=wherezit_dev;Username=wherezit;Password=wherezit_dev_password";

        optionsBuilder.UseNpgsql(connectionString);

        return new WherezItDbContext(optionsBuilder.Options);
    }
}
