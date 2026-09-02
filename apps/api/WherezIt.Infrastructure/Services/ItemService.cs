using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WherezIt.Application.Authentication;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;
using WherezIt.Application.Storage.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class ItemService : IItemService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;
    private readonly IImageObjectStorage? _storage;
    private readonly ILogger<ItemService>? _logger;

    public ItemService(
        WherezItDbContext dbContext,
        IWorkspaceAuthorizationService authorizationService,
        IImageObjectStorage? storage = null,
        ILogger<ItemService>? logger = null)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
        _storage = storage;
        _logger = logger;
    }

    public async Task<IReadOnlyList<ItemResponseDto>> GetItemsByContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var query = _dbContext.Items
            .AsNoTracking()
            .Where(i => i.WorkspaceId == workspaceId && i.ContainerId == containerId);

        if (!includeArchived)
        {
            query = query.Where(i => !i.IsArchived);
        }

        var items = await query
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

        return items.Select(MapToDto).ToList();
    }

    public async Task<ItemResponseDto> GetItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.Id == itemId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Item '{itemId}' was not found in workspace '{workspaceId}'.");
        }

        return MapToDto(item);
    }

    public async Task<ItemResponseDto> CreateItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CreateItemRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ArgumentException("Item name cannot be empty.", nameof(request));
        }

        var trimmedName = request.Name.Trim();
        if (trimmedName.Length > 100)
        {
            throw new ArgumentException("Item name must be 100 characters or fewer.", nameof(request));
        }

        if (request.Quantity < 1)
        {
            throw new ArgumentException("Item quantity must be greater than or equal to 1.", nameof(request));
        }

        var container = await _dbContext.Containers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        if (container.IsArchived)
        {
            throw new InvalidOperationException("Cannot create an item in an archived container.");
        }

        var now = DateTimeOffset.UtcNow;
        var item = new Item
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ContainerId = containerId,
            Name = trimmedName,
            Quantity = request.Quantity,
            Category = NormalizeCategory(request.Category),
            Source = "MANUAL",
            IsVerified = true,
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.Items.Add(item);
        _dbContext.ActivityHistories.Add(new ActivityHistory
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ActorUserId = identity.FirebaseUid,
            ActivityType = "ITEM_ADDED",
            ContainerId = containerId,
            PreviousLocationDisplay = string.Empty,
            DestinationLocationDisplay = $"{item.Name} · Qty {item.Quantity}",
            OccurredAt = now
        });
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task<ItemResponseDto> UpdateItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        UpdateItemRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.Id == itemId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Item '{itemId}' was not found in workspace '{workspaceId}'.");
        }

        var oldName = item.Name;
        var oldQuantity = item.Quantity;

        if (request.Name != null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new ArgumentException("Item name cannot be empty.", nameof(request));
            }
            var trimmedUpdateName = request.Name.Trim();
            if (trimmedUpdateName.Length > 100)
            {
                throw new ArgumentException("Item name must be 100 characters or fewer.", nameof(request));
            }
            item.Name = trimmedUpdateName;
        }

        if (request.Quantity.HasValue)
        {
            if (request.Quantity.Value < 1)
            {
                throw new ArgumentException("Item quantity must be greater than or equal to 1.", nameof(request));
            }
            item.Quantity = request.Quantity.Value;
        }

        if (request.Category != null)
        {
            item.Category = NormalizeCategory(request.Category);
        }

        item.UpdatedAt = DateTimeOffset.UtcNow;

        if (oldName != item.Name || oldQuantity != item.Quantity)
        {
            _dbContext.ActivityHistories.Add(new ActivityHistory
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                ActorUserId = identity.FirebaseUid,
                ActivityType = "ITEM_UPDATED",
                ContainerId = item.ContainerId,
                PreviousLocationDisplay = $"{oldName} · Qty {oldQuantity}",
                DestinationLocationDisplay = $"{item.Name} · Qty {item.Quantity}",
                OccurredAt = DateTimeOffset.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task<ItemResponseDto> ArchiveItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.Id == itemId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Item '{itemId}' was not found in workspace '{workspaceId}'.");
        }

        if (item.IsArchived)
        {
            return MapToDto(item);
        }

        item.IsArchived = true;
        item.UpdatedAt = DateTimeOffset.UtcNow;

        _dbContext.ActivityHistories.Add(new ActivityHistory
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ActorUserId = identity.FirebaseUid,
            ActivityType = "ITEM_ARCHIVED",
            ContainerId = item.ContainerId,
            PreviousLocationDisplay = string.Empty,
            DestinationLocationDisplay = $"{item.Name} · Qty {item.Quantity}",
            OccurredAt = DateTimeOffset.UtcNow
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task<ItemResponseDto> RestoreItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.Id == itemId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Item '{itemId}' was not found in workspace '{workspaceId}'.");
        }

        if (!item.IsArchived)
        {
            return MapToDto(item);
        }

        item.IsArchived = false;
        item.UpdatedAt = DateTimeOffset.UtcNow;

        _dbContext.ActivityHistories.Add(new ActivityHistory
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ActorUserId = identity.FirebaseUid,
            ActivityType = "ITEM_RESTORED",
            ContainerId = item.ContainerId,
            PreviousLocationDisplay = string.Empty,
            DestinationLocationDisplay = $"{item.Name} · Qty {item.Quantity}",
            OccurredAt = DateTimeOffset.UtcNow
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task DeleteItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.Id == itemId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Item '{itemId}' was not found in workspace '{workspaceId}'.");
        }

        if (!item.IsArchived)
        {
            throw new InvalidOperationException("Only archived items can be permanently deleted.");
        }

        // Capture snapshot before deletion
        var snapshotName = item.Name;
        var snapshotQty = item.Quantity;
        var snapshotContainerId = item.ContainerId;

        // 1. Capture item ImageAsset object paths BEFORE deleting DB rows
        var itemImageAssets = await _dbContext.ImageAssets
            .Where(img => img.WorkspaceId == workspaceId && img.ItemId == itemId)
            .ToListAsync(cancellationToken);

        var objectPathsToDelete = itemImageAssets
            .Select(img => img.ObjectPath)
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Distinct()
            .ToList();

        // 2. Perform DB deletion in ONE EF Core transaction
        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        _dbContext.ActivityHistories.Add(new ActivityHistory
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ActorUserId = identity.FirebaseUid,
            ActivityType = "ITEM_REMOVED",
            ContainerId = snapshotContainerId,
            PreviousLocationDisplay = string.Empty,
            DestinationLocationDisplay = $"{snapshotName} · Qty {snapshotQty}",
            OccurredAt = DateTimeOffset.UtcNow
        });

        _dbContext.ImageAssets.RemoveRange(itemImageAssets);
        _dbContext.Items.Remove(item);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        // 3. Physical object cleanup AFTER successful DB commit
        if (_storage != null && objectPathsToDelete.Count > 0)
        {
            foreach (var objectPath in objectPathsToDelete)
            {
                try
                {
                    await _storage.DeleteObjectAsync(objectPath, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger?.LogError(ex, "Failed to delete storage object file at path '{ObjectPath}' after item '{ItemId}' permanent deletion.", objectPath, itemId);
                }
            }
        }
    }

    private static string? NormalizeCategory(string? category)
    {
        if (string.IsNullOrWhiteSpace(category)) return null;
        var trimmed = category.Trim();
        if (trimmed.Length > 50)
        {
            throw new ArgumentException("Category cannot exceed 50 characters.");
        }
        return trimmed;
    }

    private static ItemResponseDto MapToDto(Item i)
    {
        return new ItemResponseDto(
            i.Id,
            i.WorkspaceId,
            i.ContainerId,
            i.Name,
            i.Quantity,
            i.Category,
            i.Source,
            i.IsVerified,
            i.IsArchived,
            i.CreatedAt,
            i.UpdatedAt
        );
    }
}
