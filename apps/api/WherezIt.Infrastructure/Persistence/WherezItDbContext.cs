using Microsoft.EntityFrameworkCore;

namespace WherezIt.Infrastructure.Persistence;

public class WherezItDbContext : DbContext
{
    public WherezItDbContext(DbContextOptions<WherezItDbContext> options)
        : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
    }
}
