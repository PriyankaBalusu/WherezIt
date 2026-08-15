using Microsoft.EntityFrameworkCore;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence;

public class WherezItDbContext : DbContext
{
    public WherezItDbContext(DbContextOptions<WherezItDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<WorkspaceMember> WorkspaceMembers => Set<WorkspaceMember>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WherezItDbContext).Assembly);
    }
}

