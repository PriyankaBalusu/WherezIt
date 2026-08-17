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
    public DbSet<StorageNode> StorageNodes => Set<StorageNode>();
    public DbSet<Container> Containers => Set<Container>();
    public DbSet<WorkspaceBoxCounter> WorkspaceBoxCounters => Set<WorkspaceBoxCounter>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WherezItDbContext).Assembly);
    }
}

