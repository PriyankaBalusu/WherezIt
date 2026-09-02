using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Containers.Utils;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class ContainerTransferService : IContainerTransferService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public ContainerTransferService(WherezItDbContext dbContext, IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<ContainerResponseDto> TransferContainerAsync(
        AuthenticatedIdentity identity,
        Guid inventoryNamespaceId,
        Guid containerId,
        TransferContainerRequestDto request,
        CancellationToken cancellationToken = default)
    {
        // 1. Resolve Container and verify it belongs to source namespace (No Tracking)
        var container = await _dbContext.Containers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == containerId && c.InventoryNamespaceId == inventoryNamespaceId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in inventory namespace '{inventoryNamespaceId}'.");
        }

        // 2. Cross-workspace same-destination guard
        if (container.WorkspaceId == request.DestinationWorkspaceId)
        {
            throw new ArgumentException("Destination workspace must be different from source workspace. Use the /move endpoint for relocations inside the same workspace.", nameof(request));
        }

        // 3. Resolve workspaces and verify both belong to target namespace (No Tracking)
        var sourceWorkspace = await _dbContext.Workspaces
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == container.WorkspaceId && w.InventoryNamespaceId == inventoryNamespaceId, cancellationToken);

        if (sourceWorkspace == null)
        {
            throw new KeyNotFoundException($"Source workspace '{container.WorkspaceId}' was not found in namespace '{inventoryNamespaceId}'.");
        }

        var destWorkspace = await _dbContext.Workspaces
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == request.DestinationWorkspaceId && w.InventoryNamespaceId == inventoryNamespaceId, cancellationToken);

        if (destWorkspace == null)
        {
            throw new KeyNotFoundException($"Destination workspace '{request.DestinationWorkspaceId}' was not found in namespace '{inventoryNamespaceId}'.");
        }

        // 4. Resolve destination StorageNode (No Tracking)
        var destNode = await _dbContext.StorageNodes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == request.DestinationStorageNodeId && n.WorkspaceId == request.DestinationWorkspaceId, cancellationToken);

        if (destNode == null)
        {
            throw new ArgumentException($"Destination storage node '{request.DestinationStorageNodeId}' does not exist in target workspace '{request.DestinationWorkspaceId}'.", nameof(request));
        }

        // 5. Authorize membership in both workspaces
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, container.WorkspaceId, cancellationToken);
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, request.DestinationWorkspaceId, cancellationToken);

        // 6. Execute atomic transfer within a transaction using ExecuteUpdateAsync
        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Defer composite FK checks in PostgreSQL
            await _dbContext.Database.ExecuteSqlRawAsync("SET CONSTRAINTS ALL DEFERRED;", cancellationToken);

            var previousWorkspaceId = container.WorkspaceId;
            var previousStorageNodeId = container.StorageNodeId;

            // Fetch location displays before moving
            var previousBreadcrumb = await BuildBreadcrumbDisplayAsync(previousWorkspaceId, previousStorageNodeId, cancellationToken);
            var destinationBreadcrumb = await BuildBreadcrumbDisplayAsync(request.DestinationWorkspaceId, request.DestinationStorageNodeId, cancellationToken);

            // Fetch items in the container (No Tracking) to get IDs for image assets
            var itemIds = await _dbContext.Items
                .AsNoTracking()
                .Where(i => i.ContainerId == containerId && i.WorkspaceId == previousWorkspaceId)
                .Select(i => i.Id)
                .ToListAsync(cancellationToken);

            // Fetch captures inside the container (No Tracking)
            var captures = await _dbContext.InventoryCaptures
                .AsNoTracking()
                .Where(c => c.ContainerId == containerId && c.WorkspaceId == previousWorkspaceId)
                .ToListAsync(cancellationToken);

            // Active processing safety check
            if (captures.Any(c => c.Status == "PROCESSING" || c.Status == "QUEUED"))
            {
                throw new InvalidOperationException("This box is still processing a photo. Try again when processing is complete.");
            }

            var now = DateTimeOffset.UtcNow;

            var captureIds = captures.Select(c => c.Id).ToList();

            // 7. Perform workspace updates across child graph using ExecuteUpdateAsync
            await _dbContext.Items
                .Where(i => i.ContainerId == containerId && i.WorkspaceId == previousWorkspaceId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(i => i.WorkspaceId, request.DestinationWorkspaceId)
                    .SetProperty(i => i.UpdatedAt, now),
                    cancellationToken);

            if (captureIds.Count > 0)
            {
                // Update dependent child entities of InventoryCaptures first to maintain composite FK (WorkspaceId, CaptureId) integrity
                await _dbContext.DetectionSuggestions
                    .Where(ds => captureIds.Contains(ds.CaptureId) && ds.WorkspaceId == previousWorkspaceId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(ds => ds.WorkspaceId, request.DestinationWorkspaceId)
                        .SetProperty(ds => ds.UpdatedAt, now),
                        cancellationToken);

                await _dbContext.AIProcessingJobs
                    .Where(j => captureIds.Contains(j.CaptureId) && j.WorkspaceId == previousWorkspaceId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.WorkspaceId, request.DestinationWorkspaceId)
                        .SetProperty(j => j.UpdatedAt, now),
                        cancellationToken);
            }

            await _dbContext.InventoryCaptures
                .Where(c => c.ContainerId == containerId && c.WorkspaceId == previousWorkspaceId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.WorkspaceId, request.DestinationWorkspaceId)
                    .SetProperty(c => c.UpdatedAt, now),
                    cancellationToken);

            await _dbContext.Identifiers
                .Where(i => i.ContainerId == containerId && i.WorkspaceId == previousWorkspaceId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(i => i.WorkspaceId, request.DestinationWorkspaceId)
                    .SetProperty(i => i.UpdatedAt, now),
                    cancellationToken);

            await _dbContext.ImageAssets
                .Where(x => x.ContainerId == containerId && x.WorkspaceId == previousWorkspaceId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.WorkspaceId, request.DestinationWorkspaceId)
                    .SetProperty(x => x.UpdatedAt, now),
                    cancellationToken);

            if (itemIds.Count > 0)
            {
                await _dbContext.ImageAssets
                    .Where(x => x.ItemId.HasValue && itemIds.Contains(x.ItemId.Value) && x.WorkspaceId == previousWorkspaceId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(x => x.WorkspaceId, request.DestinationWorkspaceId)
                        .SetProperty(x => x.UpdatedAt, now),
                        cancellationToken);
            }

            // On transfer the container's DestinationStorageNodeId always belongs to the source
            // workspace. Carrying it forward would violate the composite FK
            // (workspace_id, destination_storage_node_id) once workspace_id is changed.
            // Clear it unconditionally — the moving-destination hint is no longer meaningful
            // across workspace boundaries.
            await _dbContext.Containers
                .Where(c => c.Id == containerId)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(c => c.WorkspaceId, request.DestinationWorkspaceId)
                    .SetProperty(c => c.StorageNodeId, request.DestinationStorageNodeId)
                    .SetProperty(c => c.DestinationStorageNodeId, (Guid?)null)
                    .SetProperty(c => c.UpdatedAt, now),
                    cancellationToken);

            // 9. Clear ChangeTracker after bulk direct updates to prevent stale tracked entity conflicts
            _dbContext.ChangeTracker.Clear();

            // 10. Append immutable ActivityHistory records
            var historyOut = new ActivityHistory
            {
                Id = Guid.NewGuid(),
                WorkspaceId = previousWorkspaceId,
                ActorUserId = identity.FirebaseUid,
                ActivityType = "TRANSFERRED_OUT",
                ContainerId = containerId,
                PreviousStorageNodeId = previousStorageNodeId,
                DestinationStorageNodeId = null,
                PreviousLocationDisplay = $"{sourceWorkspace.Name} / {previousBreadcrumb}",
                DestinationLocationDisplay = $"{destWorkspace.Name} / {destinationBreadcrumb}",
                OccurredAt = now
            };

            var historyIn = new ActivityHistory
            {
                Id = Guid.NewGuid(),
                WorkspaceId = request.DestinationWorkspaceId,
                ActorUserId = identity.FirebaseUid,
                ActivityType = "TRANSFERRED_IN",
                ContainerId = containerId,
                PreviousStorageNodeId = null,
                DestinationStorageNodeId = request.DestinationStorageNodeId,
                PreviousLocationDisplay = $"{sourceWorkspace.Name} / {previousBreadcrumb}",
                DestinationLocationDisplay = $"{destWorkspace.Name} / {destinationBreadcrumb}",
                OccurredAt = now
            };

            _dbContext.ActivityHistories.Add(historyOut);
            _dbContext.ActivityHistories.Add(historyIn);

            await _dbContext.SaveChangesAsync(cancellationToken);
            Console.WriteLine("TRANSFER: SaveChanges succeeded");

            var updatedContainer = new Container
            {
                Id = container.Id,
                WorkspaceId = request.DestinationWorkspaceId,
                StorageNodeId = request.DestinationStorageNodeId,
                BoxNumber = container.BoxNumber,
                Name = container.Name,
                Description = container.Description,
                PhysicalLabel = container.PhysicalLabel,
                IsArchived = container.IsArchived,
                DestinationStorageNodeId = null,
                IsPacked = container.IsPacked,
                MovingPriority = container.MovingPriority,
                CreatedAt = container.CreatedAt,
                UpdatedAt = now
            };
            Console.WriteLine("TRANSFER: About to map response");

            // Build the response BEFORE committing.
            // If mapping fails, the transaction is still able to roll back.
            var response = MapToDto(updatedContainer);
            Console.WriteLine("TRANSFER: Response mapped");

await transaction.CommitAsync(cancellationToken);
Console.WriteLine("TRANSFER: Commit succeeded");

return response;
        }
        catch
        {
            try
            {
                await transaction.RollbackAsync(cancellationToken);
            }
            catch
            {
                // Ignore rollback failures if transaction already committed or aborted by DB
            }
            throw;
        }
    }

    private async Task<string> BuildBreadcrumbDisplayAsync(Guid workspaceId, Guid storageNodeId, CancellationToken cancellationToken)
    {
        var parts = new List<string>();
        var currentNodeId = (Guid?)storageNodeId;

        while (currentNodeId.HasValue)
        {
            var node = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == currentNodeId.Value && n.WorkspaceId == workspaceId, cancellationToken);

            if (node == null) break;
            parts.Insert(0, node.Name);
            currentNodeId = node.ParentId;
        }

        return parts.Count > 0 ? string.Join(" → ", parts) : "Unknown";
    }

    private static ContainerResponseDto MapToDto(Container c)
    {
        return new ContainerResponseDto(
            c.Id,
            c.WorkspaceId,
            c.StorageNodeId,
            c.BoxNumber,
            BoxIdFormatter.Format(c.BoxNumber),
            c.Name,
            c.Description,
            c.PhysicalLabel,
            c.IsArchived,
            c.DestinationStorageNodeId,
            c.IsPacked,
            c.MovingPriority,
            c.CreatedAt,
            c.UpdatedAt
        );
    }
}
