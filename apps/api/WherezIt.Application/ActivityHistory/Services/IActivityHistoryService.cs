using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.ActivityHistory.Dtos;
using WherezIt.Application.Authentication;

namespace WherezIt.Application.ActivityHistory.Services;

public interface IActivityHistoryService
{
    Task<List<ActivityHistoryDto>> GetContainerHistoryAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        int page = 1,
        int pageSize = 10,
        CancellationToken cancellationToken = default);

    Task<List<ActivityHistoryDto>> GetWorkspaceHistoryAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        int page = 1,
        int pageSize = 10,
        CancellationToken cancellationToken = default);

    Task<List<ActivityHistoryDto>> GetLocationHistoryAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        int page = 1,
        int pageSize = 10,
        CancellationToken cancellationToken = default);
}
