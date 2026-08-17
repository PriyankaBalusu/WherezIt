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

        var container = await _dbContext.Containers
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        if (container.IsArchived)
        {
            throw new InvalidOperationException("Cannot move an archived container.");
        }

        if (container.StorageNodeId == request.StorageNodeId)
        {
            return MapToDto(container);
        }

        var destinationNode = await _dbContext.StorageNodes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.Id == request.StorageNodeId, cancellationToken);

        if (destinationNode == null || destinationNode.WorkspaceId != workspaceId)
        {
            throw new ArgumentException($"Destination storage location '{request.StorageNodeId}' does not exist in workspace '{workspaceId}'.", nameof(request));
        }

        container.StorageNodeId = request.StorageNodeId;
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
