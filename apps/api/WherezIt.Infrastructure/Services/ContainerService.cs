using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Containers.Utils;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class ContainerService : IContainerService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;
    private readonly IBoxNumberAllocator _allocator;

    public ContainerService(
        WherezItDbContext dbContext,
        IWorkspaceAuthorizationService authorizationService,
        IBoxNumberAllocator allocator)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
        _allocator = allocator;
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

        // 3. Allocate next BOX number atomically
        var boxNumber = await _allocator.AllocateNextAsync(workspaceId, cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var container = new Container
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            StorageNodeId = request.StorageNodeId,
            BoxNumber = boxNumber,
            Name = request.Name?.Trim(),
            Description = request.Description?.Trim(),
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

        container.Name = request.Name?.Trim();
        container.Description = request.Description?.Trim();
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
            c.IsArchived,
            c.CreatedAt,
            c.UpdatedAt
        );
    }
}
