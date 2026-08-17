using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class LocationMoveService : ILocationMoveService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public LocationMoveService(WherezItDbContext dbContext, IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<StorageLocationResponseDto> MoveLocationAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        MoveStorageLocationRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var node = await _dbContext.StorageNodes
            .FirstOrDefaultAsync(n => n.WorkspaceId == workspaceId && n.Id == locationId, cancellationToken);

        if (node == null)
        {
            throw new KeyNotFoundException($"Storage location '{locationId}' was not found in workspace '{workspaceId}'.");
        }

        if (node.ParentId == request.ParentId)
        {
            return MapToDto(node);
        }

        if (request.ParentId.HasValue)
        {
            if (request.ParentId.Value == locationId)
            {
                throw new ArgumentException("Cannot move a location under itself.", nameof(request));
            }

            var targetParent = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == request.ParentId.Value, cancellationToken);

            if (targetParent == null || targetParent.WorkspaceId != workspaceId)
            {
                throw new ArgumentException($"Target parent location '{request.ParentId}' does not exist in workspace '{workspaceId}'.", nameof(request));
            }

            // Ancestry traversal to prevent descendant cycles
            var currentParentId = targetParent.ParentId;
            while (currentParentId.HasValue)
            {
                if (currentParentId.Value == locationId)
                {
                    throw new ArgumentException("Cannot move a location under one of its descendants.", nameof(request));
                }

                var ancestor = await _dbContext.StorageNodes
                    .AsNoTracking()
                    .FirstOrDefaultAsync(n => n.Id == currentParentId.Value, cancellationToken);

                currentParentId = ancestor?.ParentId;
            }
        }

        node.ParentId = request.ParentId;
        node.UpdatedAt = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(node);
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
