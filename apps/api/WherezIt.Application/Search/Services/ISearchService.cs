using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.Authentication;
using WherezIt.Domain.Entities;

namespace WherezIt.Application.Search.Services;

public interface ISearchService
{
    Task<IReadOnlyList<Item>> SearchItemsAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        string query,
        bool includeArchived = false,
        CancellationToken cancellationToken = default);
}
