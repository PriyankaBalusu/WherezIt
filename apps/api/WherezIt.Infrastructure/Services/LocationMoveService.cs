using Microsoft.EntityFrameworkCore;
using Npgsql;
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

        var normalizedName = node.Name.Trim().ToLower();
        var isDuplicate = await _dbContext.StorageNodes.AnyAsync(
            n => n.WorkspaceId == workspaceId &&
                 n.ParentId == request.ParentId &&
                 n.Id != locationId &&
                 n.Name.ToLower() == normalizedName,
            cancellationToken);

        if (isDuplicate)
        {
            var duplicateMsg = request.ParentId.HasValue
                ? $"A storage location named '{node.Name}' already exists under this location."
                : $"A storage location named '{node.Name}' already exists in this Storage Space.";
            throw new InvalidOperationException(duplicateMsg);
        }

        node.ParentId = request.ParentId;
        node.UpdatedAt = DateTimeOffset.UtcNow;

        try
        {
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
                    ? $"A storage location named '{node.Name}' already exists under this location."
                    : $"A storage location named '{node.Name}' already exists in this Storage Space.";
                throw new InvalidOperationException(duplicateMsg, ex);
            }
            throw;
        }

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
