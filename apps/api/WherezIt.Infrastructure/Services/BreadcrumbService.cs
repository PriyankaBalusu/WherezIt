using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class BreadcrumbService : IBreadcrumbService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public BreadcrumbService(WherezItDbContext dbContext, IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<BreadcrumbResponseDto> GetBreadcrumbAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var workspace = await _dbContext.Workspaces
            .AsNoTracking()
            .FirstOrDefaultAsync(w => w.Id == workspaceId, cancellationToken);

        if (workspace == null)
        {
            throw new KeyNotFoundException($"Workspace '{workspaceId}' was not found.");
        }

        var currentNode = await _dbContext.StorageNodes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.WorkspaceId == workspaceId && n.Id == locationId, cancellationToken);

        if (currentNode == null)
        {
            throw new KeyNotFoundException($"Storage location '{locationId}' was not found in workspace '{workspaceId}'.");
        }

        var segmentsReversed = new List<BreadcrumbSegmentDto>();
        var visitedNodeIds = new HashSet<Guid>();
        const int maxDepthGuard = 50;

        while (currentNode != null)
        {
            if (currentNode.WorkspaceId != workspaceId)
            {
                throw new InvalidOperationException("Cross-workspace location hierarchy anomaly detected.");
            }

            if (!visitedNodeIds.Add(currentNode.Id) || visitedNodeIds.Count > maxDepthGuard)
            {
                throw new InvalidOperationException("Location hierarchy cycle or excessive depth detected.");
            }

            segmentsReversed.Add(new BreadcrumbSegmentDto(currentNode.Id, currentNode.Name));

            if (!currentNode.ParentId.HasValue)
            {
                break;
            }

            currentNode = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == currentNode.ParentId.Value, cancellationToken);
        }

        segmentsReversed.Reverse();

        var displayPath = workspace.Name + " → " + string.Join(" → ", segmentsReversed.Select(s => s.Name));

        return new BreadcrumbResponseDto(
            workspaceId,
            workspace.Name,
            locationId,
            segmentsReversed,
            displayPath
        );
    }
}
