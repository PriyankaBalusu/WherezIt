using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WherezIt.Application.ActivityHistory.Dtos;
using WherezIt.Application.ActivityHistory.Services;
using WherezIt.Application.Authentication;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class ActivityHistoryService : IActivityHistoryService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public ActivityHistoryService(WherezItDbContext dbContext, IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<List<ActivityHistoryDto>> GetContainerHistoryAsync(
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

        var historyList = await _dbContext.ActivityHistories
            .AsNoTracking()
            .Where(a => a.WorkspaceId == workspaceId && a.ContainerId == containerId)
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.Id)
            .Select(a => new ActivityHistoryDto(
                a.Id,
                a.ActivityType,
                a.ContainerId,
                a.PreviousStorageNodeId,
                a.PreviousLocationDisplay,
                a.DestinationStorageNodeId,
                a.DestinationLocationDisplay,
                a.ActorUserId,
                a.OccurredAt
            ))
            .ToListAsync(cancellationToken);

        return historyList;
    }
}
