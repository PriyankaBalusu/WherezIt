using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Containers.Utils;
using WherezIt.Application.Storage.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class ContainerService : IContainerService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;
    private readonly IBoxNumberAllocator _allocator;
    private readonly IImageObjectStorage? _storage;
    private readonly ILogger<ContainerService>? _logger;

    public ContainerService(
        WherezItDbContext dbContext,
        IWorkspaceAuthorizationService authorizationService,
        IBoxNumberAllocator allocator,
        IImageObjectStorage? storage = null,
        ILogger<ContainerService>? logger = null)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
        _allocator = allocator;
        _storage = storage;
        _logger = logger;
    }

    public async Task<List<ContainerResponseDto>> GetContainersAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid? storageNodeId = null,
        bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var query = _dbContext.Containers
            .AsNoTracking()
            .Where(c => c.WorkspaceId == workspaceId);

        if (!includeArchived)
        {
            query = query.Where(c => !c.IsArchived);
        }

        if (storageNodeId.HasValue)
        {
            // Verify location belongs to workspace to prevent leaking information
            var locationExistsInWorkspace = await _dbContext.StorageNodes
                .AsNoTracking()
                .AnyAsync(n => n.WorkspaceId == workspaceId && n.Id == storageNodeId.Value, cancellationToken);

            if (!locationExistsInWorkspace)
            {
                return new List<ContainerResponseDto>();
            }

            query = query.Where(c => c.StorageNodeId == storageNodeId.Value);
        }

        var containers = await query
            .OrderBy(c => c.BoxNumber)
            .ToListAsync(cancellationToken);

        return containers.Select(MapToDto).ToList();
    }

    public async Task<ContainerResponseDto> GetContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        return MapToDto(container);
    }

    public async Task<ContainerResponseDto> CreateContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        CreateContainerRequestDto request,
        CancellationToken cancellationToken = default)
    {
        // 1. Verify workspace membership BEFORE allocation
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        // 2. Verify StorageNode belongs to workspace BEFORE allocation
        var storageNode = await _dbContext.StorageNodes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == request.StorageNodeId, cancellationToken);

        if (storageNode == null || storageNode.WorkspaceId != workspaceId)
        {
            throw new ArgumentException($"Storage location '{request.StorageNodeId}' does not exist in workspace '{workspaceId}'.", nameof(request));
        }

        if (request.DestinationStorageNodeId.HasValue)
        {
            var destNode = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == request.DestinationStorageNodeId.Value && n.WorkspaceId == workspaceId, cancellationToken);

            if (destNode == null)
            {
                throw new ArgumentException($"Destination location '{request.DestinationStorageNodeId}' does not exist in workspace '{workspaceId}'.", nameof(request));
            }
        }

        string? normPriority = null;
        if (!string.IsNullOrWhiteSpace(request.MovingPriority))
        {
            normPriority = request.MovingPriority.Trim().ToUpperInvariant();
            if (normPriority != "LOW" && normPriority != "MEDIUM" && normPriority != "HIGH")
            {
                throw new ArgumentException("Moving priority must be 'LOW', 'MEDIUM', or 'HIGH'.", nameof(request));
            }
        }

        string? normPhysicalLabel = null;
        if (!string.IsNullOrWhiteSpace(request.PhysicalLabel))
        {
            normPhysicalLabel = request.PhysicalLabel.Trim();
            if (normPhysicalLabel.Length > 100)
            {
                throw new ArgumentException("Physical label cannot exceed 100 characters.", nameof(request));
            }
        }

        var workspace = await _dbContext.Workspaces
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == workspaceId, cancellationToken);
        if (workspace == null)
        {
            throw new KeyNotFoundException($"Workspace '{workspaceId}' not found.");
        }

        // 3. Allocate next BOX number atomically
        var boxNumber = await _allocator.AllocateNextAsync(workspace.InventoryNamespaceId, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var container = new Container
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            InventoryNamespaceId = workspace.InventoryNamespaceId,
            StorageNodeId = request.StorageNodeId,
            BoxNumber = boxNumber,
            Name = request.Name?.Trim(),
            Description = request.Description?.Trim(),
            PhysicalLabel = normPhysicalLabel,
            DestinationStorageNodeId = request.DestinationStorageNodeId,
            IsPacked = request.IsPacked ?? false,
            MovingPriority = normPriority,
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.Containers.Add(container);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(container);
    }

    public async Task<ContainerResponseDto> UpdateContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        UpdateContainerRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        if (request.DestinationStorageNodeId.HasValue)
        {
            var destNode = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == request.DestinationStorageNodeId.Value && n.WorkspaceId == workspaceId, cancellationToken);

            if (destNode == null)
            {
                throw new ArgumentException($"Destination location '{request.DestinationStorageNodeId}' does not exist in workspace '{workspaceId}'.", nameof(request));
            }
        }

        if (!string.IsNullOrWhiteSpace(request.MovingPriority))
        {
            var normPriority = request.MovingPriority.Trim().ToUpperInvariant();
            if (normPriority != "LOW" && normPriority != "MEDIUM" && normPriority != "HIGH")
            {
                throw new ArgumentException("Moving priority must be 'LOW', 'MEDIUM', or 'HIGH'.", nameof(request));
            }
            container.MovingPriority = normPriority;
        }
        else if (request.MovingPriority == string.Empty)
        {
            container.MovingPriority = null;
        }

        if (request.PhysicalLabel != null)
        {
            var normLabel = request.PhysicalLabel.Trim();
            if (normLabel.Length > 100)
            {
                throw new ArgumentException("Physical label cannot exceed 100 characters.", nameof(request));
            }
            container.PhysicalLabel = string.IsNullOrEmpty(normLabel) ? null : normLabel;
        }

        container.Name = request.Name?.Trim();
        container.Description = request.Description?.Trim();
        if (request.DestinationStorageNodeId.HasValue || request.DestinationStorageNodeId == null)
        {
            container.DestinationStorageNodeId = request.DestinationStorageNodeId;
        }
        if (request.IsPacked.HasValue)
        {
            container.IsPacked = request.IsPacked.Value;
        }
        container.UpdatedAt = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(container);
    }

    public async Task<ContainerResponseDto> ArchiveContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        container.IsArchived = true;
        container.UpdatedAt = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(container);
    }

    public async Task<ContainerResponseDto> RestoreContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        container.IsArchived = false;
        container.UpdatedAt = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(container);
    }

    public async Task DeleteContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        // 1. Verify workspace membership
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        // 2. Fetch Container in workspace
        var container = await _dbContext.Containers
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        // 3. Precondition: Must be archived
        if (!container.IsArchived)
        {
            throw new InvalidOperationException("Cannot permanently delete an active container. Archive the box first.");
        }

        // 4. Precondition: User must be an OWNER of the workspace
        var role = await _authorizationService.GetWorkspaceRoleAsync(identity, workspaceId, cancellationToken);
        if (role != Domain.Enums.WorkspaceRole.OWNER)
        {
            throw new UnauthorizedAccessException("Only workspace owners can permanently delete containers.");
        }

        // 5. Query dependent entities in audited order: Items -> InventoryCaptures -> ImageAssets -> Container
        var items = await _dbContext.Items
            .Where(i => i.WorkspaceId == workspaceId && i.ContainerId == containerId)
            .ToListAsync(cancellationToken);

        var captures = await _dbContext.InventoryCaptures
            .Where(c => c.WorkspaceId == workspaceId && c.ContainerId == containerId)
            .ToListAsync(cancellationToken);

        var imageAssets = await _dbContext.ImageAssets
            .Where(img => img.WorkspaceId == workspaceId && img.ContainerId == containerId)
            .ToListAsync(cancellationToken);

        // Capture object paths BEFORE deleting DB rows
        var objectPathsToDelete = imageAssets
            .Select(img => img.ObjectPath)
            .Where(path => !string.IsNullOrWhiteSpace(path))
            .Distinct()
            .ToList();

        // 6. Perform DB deletion in ONE EF Core transaction
        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        _dbContext.Items.RemoveRange(items);
        _dbContext.InventoryCaptures.RemoveRange(captures);
        _dbContext.ImageAssets.RemoveRange(imageAssets);
        _dbContext.Containers.Remove(container);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        // 7. Physical object cleanup AFTER successful DB commit
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
                    _logger?.LogError(ex, "Failed to delete storage object file at path '{ObjectPath}' after container '{ContainerId}' permanent deletion.", objectPath, containerId);
                }
            }
        }
    }

    public async Task<ContainerResponseDto> UnpackContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        // 1. Verify workspace membership
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        // 2. Fetch Container in workspace
        var container = await _dbContext.Containers
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        // 3. Idempotency Check: If already unpacked, return current state
        if (!container.IsPacked && container.MovingPriority == null && container.DestinationStorageNodeId == null)
        {
            return MapToDto(container);
        }

        // 4. Perform moving lifecycle cleanup
        container.IsPacked = false;
        container.MovingPriority = null;
        container.DestinationStorageNodeId = null;
        container.UpdatedAt = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(container);
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
