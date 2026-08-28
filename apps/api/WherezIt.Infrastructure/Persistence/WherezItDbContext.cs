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
    public DbSet<Item> Items => Set<Item>();
    public DbSet<ImageAsset> ImageAssets => Set<ImageAsset>();
    public DbSet<InventoryCapture> InventoryCaptures => Set<InventoryCapture>();
    public DbSet<DetectionSuggestion> DetectionSuggestions => Set<DetectionSuggestion>();
    public DbSet<AIProcessingJob> AIProcessingJobs => Set<AIProcessingJob>();
    public DbSet<Identifier> Identifiers => Set<Identifier>();
    public DbSet<ActivityHistory> ActivityHistories => Set<ActivityHistory>();
    public DbSet<InventoryNamespace> InventoryNamespaces => Set<InventoryNamespace>();
    public DbSet<InventoryNamespaceMember> InventoryNamespaceMembers => Set<InventoryNamespaceMember>();
    public DbSet<InventoryNamespaceBoxCounter> InventoryNamespaceBoxCounters => Set<InventoryNamespaceBoxCounter>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WherezItDbContext).Assembly);
    }

    public override async Task<int> SaveChangesAsync(System.Threading.CancellationToken cancellationToken = default)
    {
        // Intercept added workspaces to backfill inventory namespace if missing
        var addedWorkspaces = ChangeTracker.Entries<Workspace>()
            .Where(e => e.State == EntityState.Added && e.Entity.InventoryNamespaceId == Guid.Empty)
            .ToList();

        if (addedWorkspaces.Count > 0)
        {
            var defaultNamespace = ChangeTracker.Entries<InventoryNamespace>().Select(e => e.Entity).FirstOrDefault()
                                   ?? await InventoryNamespaces.FirstOrDefaultAsync(cancellationToken);

            if (defaultNamespace == null)
            {
                defaultNamespace = new InventoryNamespace
                {
                    Id = Guid.NewGuid(),
                    Name = "Default Test Inventory",
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };
                InventoryNamespaces.Add(defaultNamespace);

                InventoryNamespaceBoxCounters.Add(new InventoryNamespaceBoxCounter
                {
                    InventoryNamespaceId = defaultNamespace.Id,
                    NextBoxNumber = 1
                });
            }

            foreach (var entry in addedWorkspaces)
            {
                entry.Entity.InventoryNamespaceId = defaultNamespace.Id;
            }
        }

        // Intercept added containers to backfill inventory namespace if missing
        var addedContainers = ChangeTracker.Entries<Container>()
            .Where(e => e.State == EntityState.Added && e.Entity.InventoryNamespaceId == Guid.Empty)
            .ToList();

        if (addedContainers.Count > 0)
        {
            foreach (var entry in addedContainers)
            {
                var wsId = entry.Entity.WorkspaceId;
                var ws = await Workspaces.FindAsync(new object[] { wsId }, cancellationToken)
                         ?? ChangeTracker.Entries<Workspace>().FirstOrDefault(e => e.Entity.Id == wsId)?.Entity;

                if (ws != null)
                {
                    entry.Entity.InventoryNamespaceId = ws.InventoryNamespaceId;
                }
            }
        }

        return await base.SaveChangesAsync(cancellationToken);
    }
}

