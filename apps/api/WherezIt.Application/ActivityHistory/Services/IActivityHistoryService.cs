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
        CancellationToken cancellationToken = default);
}
