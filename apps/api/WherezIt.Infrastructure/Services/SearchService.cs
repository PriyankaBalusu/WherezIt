using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.Search.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class SearchService : ISearchService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public SearchService(
        WherezItDbContext dbContext,
        IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<IReadOnlyList<Item>> SearchItemsAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        string query,
        bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var trimmedQuery = query?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedQuery))
        {
            return Array.Empty<Item>();
        }

        var baseQuery = _dbContext.Items
            .AsNoTracking()
            .Where(i => i.WorkspaceId == workspaceId);

        if (!includeArchived)
        {
            baseQuery = baseQuery.Where(i => !i.IsArchived);
        }

        var results = await baseQuery
            .Where(i => EF.Functions.ToTsVector("english", i.Name).Matches(EF.Functions.WebSearchToTsQuery("english", trimmedQuery))
                        || EF.Functions.ILike(i.Name, $"%{trimmedQuery}%"))
            .ToListAsync(cancellationToken);

        return results;
    }
}
