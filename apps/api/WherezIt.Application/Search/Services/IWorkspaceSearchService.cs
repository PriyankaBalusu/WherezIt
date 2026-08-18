using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.Authentication;
using WherezIt.Application.Search.Dtos;

namespace WherezIt.Application.Search.Services;

public interface IWorkspaceSearchService
{
    Task<IReadOnlyList<SearchResultDto>> SearchWorkspaceAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        string query,
        CancellationToken cancellationToken = default);
}
