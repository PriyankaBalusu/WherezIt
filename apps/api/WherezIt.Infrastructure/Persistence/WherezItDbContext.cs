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
    public DbSet<Item> Items => Set<Item>();
    public DbSet<ImageAsset> ImageAssets => Set<ImageAsset>();
    public DbSet<InventoryCapture> InventoryCaptures => Set<InventoryCapture>();
    public DbSet<DetectionSuggestion> DetectionSuggestions => Set<DetectionSuggestion>();
    public DbSet<AIProcessingJob> AIProcessingJobs => Set<AIProcessingJob>();
    public DbSet<Identifier> Identifiers => Set<Identifier>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WherezItDbContext).Assembly);
    }
}

