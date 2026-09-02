using Microsoft.EntityFrameworkCore;
using Npgsql;
using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Users.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class StorageLocationService : IStorageLocationService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;
    private readonly IUserService _userService;

    public StorageLocationService(
        WherezItDbContext dbContext,
        IWorkspaceAuthorizationService authorizationService,
        IUserService userService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
        _userService = userService;
    }

    public async Task<List<StorageLocationResponseDto>> GetLocationsAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var nodes = await _dbContext.StorageNodes
            .AsNoTracking()
            .Where(n => n.WorkspaceId == workspaceId)
            .OrderBy(n => n.Name)
            .ToListAsync(cancellationToken);

        return nodes.Select(MapToDto).ToList();
    }

    public async Task<StorageLocationResponseDto> GetLocationAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var node = await _dbContext.StorageNodes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.WorkspaceId == workspaceId && n.Id == locationId, cancellationToken);

        if (node == null)
        {
            throw new KeyNotFoundException($"Storage location '{locationId}' was not found in workspace '{workspaceId}'.");
        }

        return MapToDto(node);
    }

    public async Task<StorageLocationResponseDto> CreateLocationAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        CreateStorageLocationRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var trimmedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            throw new ArgumentException("Location name cannot be empty.", nameof(request));
        }

        if (trimmedName.Length > 100)
        {
            throw new ArgumentException("Location name cannot exceed 100 characters.", nameof(request));
        }

        string? parentLocationName = null;
        if (request.ParentId.HasValue)
        {
            var parent = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == request.ParentId.Value, cancellationToken);

            if (parent == null || parent.WorkspaceId != workspaceId)
            {
                throw new ArgumentException($"Target parent location '{request.ParentId}' does not exist in workspace '{workspaceId}'.", nameof(request));
            }
            parentLocationName = parent.Name;
        }

        var normalizedName = trimmedName.ToLower();
        var isDuplicate = await _dbContext.StorageNodes.AnyAsync(
            n => n.WorkspaceId == workspaceId &&
                 n.ParentId == request.ParentId &&
                 n.Name.ToLower() == normalizedName,
            cancellationToken);

        if (isDuplicate)
        {
            var duplicateMsg = request.ParentId.HasValue
                ? $"A storage location named '{trimmedName}' already exists under this location."
                : $"A storage location named '{trimmedName}' already exists in this Storage Space.";
            throw new InvalidOperationException(duplicateMsg);
        }

        var now = DateTimeOffset.UtcNow;
        var node = new StorageNode
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ParentId = request.ParentId,
            Name = trimmedName,
            CreatedAt = now,
            UpdatedAt = now
        };

        try
        {
            _dbContext.StorageNodes.Add(node);
            await RecordLocationAuditAsync(identity, workspaceId, "LOCATION_CREATED", new
            {
                locationId = node.Id,
                locationName = node.Name,
                parentLocationId = node.ParentId,
                parentLocationName = parentLocationName
            }, cancellationToken);

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            if (ex.InnerException is PostgresException pgEx &&
                pgEx.SqlState == "23505" &&
                !string.IsNullOrEmpty(pgEx.ConstraintName) &&
                (pgEx.ConstraintName.Equals("ix_storage_nodes_workspace_parent_lower_name", StringComparison.OrdinalIgnoreCase) ||
                 pgEx.ConstraintName.Equals("ix_storage_nodes_workspace_root_lower_name", StringComparison.OrdinalIgnoreCase)))
            {
                var duplicateMsg = request.ParentId.HasValue
                    ? $"A storage location named '{trimmedName}' already exists under this location."
                    : $"A storage location named '{trimmedName}' already exists in this Storage Space.";
                throw new InvalidOperationException(duplicateMsg, ex);
            }
            throw;
        }

        return MapToDto(node);
    }

    public async Task<StorageLocationResponseDto> RenameLocationAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        RenameStorageLocationRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var trimmedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            throw new ArgumentException("Location name cannot be empty.", nameof(request));
        }

        if (trimmedName.Length > 100)
        {
            throw new ArgumentException("Location name cannot exceed 100 characters.", nameof(request));
        }

        var node = await _dbContext.StorageNodes
            .FirstOrDefaultAsync(n => n.WorkspaceId == workspaceId && n.Id == locationId, cancellationToken);

        if (node == null)
        {
            throw new KeyNotFoundException($"Storage location '{locationId}' was not found in workspace '{workspaceId}'.");
        }

        if (node.Name == trimmedName)
        {
            return MapToDto(node);
        }

        var normalizedName = trimmedName.ToLower();
        var isDuplicate = await _dbContext.StorageNodes.AnyAsync(
            n => n.WorkspaceId == workspaceId &&
                 n.ParentId == node.ParentId &&
                 n.Id != locationId &&
                 n.Name.ToLower() == normalizedName,
            cancellationToken);

        if (isDuplicate)
        {
            var duplicateMsg = node.ParentId.HasValue
                ? $"A storage location named '{trimmedName}' already exists under this location."
                : $"A storage location named '{trimmedName}' already exists in this Storage Space.";
            throw new InvalidOperationException(duplicateMsg);
        }

        string? parentLocationName = null;
        if (node.ParentId.HasValue)
        {
            var parent = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == node.ParentId.Value, cancellationToken);
            parentLocationName = parent?.Name;
        }

        var previousName = node.Name;
        node.Name = trimmedName;
        node.UpdatedAt = DateTimeOffset.UtcNow;

        try
        {
            await RecordLocationAuditAsync(identity, workspaceId, "LOCATION_RENAMED", new
            {
                locationId = node.Id,
                previousLocationName = previousName,
                newLocationName = trimmedName,
                parentLocationId = node.ParentId,
                parentLocationName = parentLocationName
            }, cancellationToken);

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            if (ex.InnerException is PostgresException pgEx &&
                pgEx.SqlState == "23505" &&
                !string.IsNullOrEmpty(pgEx.ConstraintName) &&
                (pgEx.ConstraintName.Equals("ix_storage_nodes_workspace_parent_lower_name", StringComparison.OrdinalIgnoreCase) ||
                 pgEx.ConstraintName.Equals("ix_storage_nodes_workspace_root_lower_name", StringComparison.OrdinalIgnoreCase)))
            {
                var duplicateMsg = node.ParentId.HasValue
                    ? $"A storage location named '{trimmedName}' already exists under this location."
                    : $"A storage location named '{trimmedName}' already exists in this Storage Space.";
                throw new InvalidOperationException(duplicateMsg, ex);
            }
            throw;
        }

        return MapToDto(node);
    }

    public async Task DeleteLocationAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var node = await _dbContext.StorageNodes
            .FirstOrDefaultAsync(n => n.WorkspaceId == workspaceId && n.Id == locationId, cancellationToken);

        if (node == null)
        {
            throw new KeyNotFoundException($"Storage location '{locationId}' was not found in workspace '{workspaceId}'.");
        }

        var hasChildren = await _dbContext.StorageNodes
            .AnyAsync(n => n.WorkspaceId == workspaceId && n.ParentId == locationId, cancellationToken);

        if (hasChildren)
        {
            throw new InvalidOperationException("Cannot delete storage location because it contains child locations.");
        }

        var hasContainers = await _dbContext.Containers
            .AnyAsync(c => c.WorkspaceId == workspaceId && (c.StorageNodeId == locationId || c.DestinationStorageNodeId == locationId), cancellationToken);

        if (hasContainers)
        {
            throw new InvalidOperationException("Cannot delete storage location because it contains boxes.");
        }

        string? parentLocationName = null;
        if (node.ParentId.HasValue)
        {
            var parent = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == node.ParentId.Value, cancellationToken);
            parentLocationName = parent?.Name;
        }

        var locationIdToDelete = node.Id;
        var locationNameToDelete = node.Name;
        var parentLocationIdToDelete = node.ParentId;

        try
        {
            _dbContext.StorageNodes.Remove(node);
            await RecordLocationAuditAsync(identity, workspaceId, "LOCATION_DELETED", new
            {
                locationId = locationIdToDelete,
                locationName = locationNameToDelete,
                parentLocationId = parentLocationIdToDelete,
                parentLocationName = parentLocationName
            }, cancellationToken);

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            if (ex.InnerException is PostgresException pgEx && pgEx.SqlState == "23503")
            {
                throw new InvalidOperationException("Cannot delete storage location because it is in use by boxes or child locations.", ex);
            }

            throw;
        }
    }

    private async Task RecordLocationAuditAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        string eventType,
        object detailsObj,
        CancellationToken cancellationToken)
    {
        var user = await _userService.SyncCurrentUserAsync(identity, cancellationToken);
        var workspace = await _dbContext.Workspaces
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == workspaceId, cancellationToken);

        if (workspace == null) return;

        var memberUserIds = await _dbContext.WorkspaceMembers
            .AsNoTracking()
            .Where(m => m.WorkspaceId == workspaceId)
            .Select(m => m.UserId.ToString())
            .ToListAsync(cancellationToken);

        if (!memberUserIds.Contains(user.Id.ToString()))
        {
            memberUserIds.Add(user.Id.ToString());
        }

        var audit = new WorkspaceAudit
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            WorkspaceName = workspace.Name,
            InventoryNamespaceId = workspace.InventoryNamespaceId,
            EventType = eventType,
            ActorUserId = user.Id.ToString(),
            AllowedUserIds = string.Join(",", memberUserIds),
            OccurredAt = DateTimeOffset.UtcNow,
            DetailsJson = System.Text.Json.JsonSerializer.Serialize(detailsObj)
        };

        _dbContext.WorkspaceAudits.Add(audit);
    }

    private static StorageLocationResponseDto MapToDto(StorageNode node)
    {
        return new StorageLocationResponseDto(
            node.Id,
            node.WorkspaceId,
            node.ParentId,
            node.Name,
            node.CreatedAt,
            node.UpdatedAt
        );
    }
}
