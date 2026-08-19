using System;
using System.Collections.Generic;
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

public class ContainerMoveService : IContainerMoveService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public ContainerMoveService(WherezItDbContext dbContext, IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<ContainerResponseDto> MoveContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        MoveContainerRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var container = await _dbContext.Containers
                .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

            if (container == null)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
            }

            if (container.IsArchived)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new InvalidOperationException("Cannot move an archived container.");
            }

            // No-op move check
            if (container.StorageNodeId == request.StorageNodeId)
            {
                await transaction.CommitAsync(cancellationToken);
                return MapToDto(container);
            }

            var destinationNode = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == request.StorageNodeId && n.WorkspaceId == workspaceId, cancellationToken);

            if (destinationNode == null)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new ArgumentException($"Destination storage location '{request.StorageNodeId}' does not exist in workspace '{workspaceId}'.", nameof(request));
            }

            var previousStorageNodeId = container.StorageNodeId;

            // Capture immutable historical location snapshots BEFORE move is executed
            var previousBreadcrumb = await BuildBreadcrumbDisplayAsync(workspaceId, previousStorageNodeId, cancellationToken);
            var destinationBreadcrumb = await BuildBreadcrumbDisplayAsync(workspaceId, request.StorageNodeId, cancellationToken);

            // Execute move
            container.StorageNodeId = request.StorageNodeId;
            container.UpdatedAt = DateTimeOffset.UtcNow;

            // Create immutable ActivityHistory audit record
            var history = new ActivityHistory
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                ActorUserId = identity.FirebaseUid,
                ActivityType = "CONTAINER_MOVED",
                ContainerId = containerId,
                PreviousStorageNodeId = previousStorageNodeId,
                DestinationStorageNodeId = request.StorageNodeId,
                PreviousLocationDisplay = previousBreadcrumb,
                DestinationLocationDisplay = destinationBreadcrumb,
                OccurredAt = DateTimeOffset.UtcNow
            };

            _dbContext.ActivityHistories.Add(history);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return MapToDto(container);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
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
            c.IsArchived,
            c.DestinationStorageNodeId,
            c.IsPacked,
            c.MovingPriority,
            c.CreatedAt,
            c.UpdatedAt
        );
    }
}
