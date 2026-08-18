using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.Search.Dtos;
using WherezIt.Application.Search.Services;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class WorkspaceSearchService : IWorkspaceSearchService
{
    private static readonly Regex BoxQueryRegex = new Regex(@"^(?:BOX\s*)?(\d{1,6})$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private readonly WherezItDbContext _dbContext;
    private readonly ISearchService _itemSearchService;
    private readonly IBreadcrumbService _breadcrumbService;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public WorkspaceSearchService(
        WherezItDbContext dbContext,
        ISearchService itemSearchService,
        IBreadcrumbService breadcrumbService,
        IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _itemSearchService = itemSearchService;
        _breadcrumbService = breadcrumbService;
        _authorizationService = authorizationService;
    }

    public async Task<IReadOnlyList<SearchResultDto>> SearchWorkspaceAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        string query,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        if (string.IsNullOrWhiteSpace(query))
        {
            return Array.Empty<SearchResultDto>();
        }

        var trimmedQuery = query.Trim();
        if (trimmedQuery.Length > 100)
        {
            trimmedQuery = trimmedQuery.Substring(0, 100).Trim();
        }

        if (string.IsNullOrWhiteSpace(trimmedQuery))
        {
            return Array.Empty<SearchResultDto>();
        }

        // Check if query is a clear BOX ID lookup
        var boxMatch = BoxQueryRegex.Match(trimmedQuery);
        if (boxMatch.Success && int.TryParse(boxMatch.Groups[1].Value, out int boxNumber))
        {
            var container = await _dbContext.Containers
                .AsNoTracking()
                .Include(c => c.StorageNode)
                .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.BoxNumber == boxNumber && !c.IsArchived, cancellationToken);

            if (container == null)
            {
                return Array.Empty<SearchResultDto>();
            }

            var (locationId, locationName, breadcrumbSegments, breadcrumbDisplay) = await ResolveLocationBreadcrumbAsync(identity, workspaceId, container.StorageNodeId, container.StorageNode?.Name, cancellationToken);

            var boxDisplayId = container.BoxNumber < 1000 ? $"BOX {container.BoxNumber:D3}" : $"BOX {container.BoxNumber}";

            return new[]
            {
                new SearchResultDto
                {
                    ResultType = "CONTAINER",
                    ItemId = null,
                    ItemName = null,
                    Quantity = null,
                    ContainerId = container.Id,
                    BoxNumber = container.BoxNumber,
                    BoxDisplayId = boxDisplayId,
                    LocationId = locationId,
                    LocationName = locationName,
                    Breadcrumb = breadcrumbSegments,
                    BreadcrumbDisplay = breadcrumbDisplay
                }
            };
        }

        // Ordinary Item Name FTS query
        var matchedItems = await _itemSearchService.SearchItemsAsync(identity, workspaceId, trimmedQuery, includeArchived: false, cancellationToken);

        if (matchedItems.Count == 0)
        {
            return Array.Empty<SearchResultDto>();
        }

        var itemIds = matchedItems.Select(i => i.Id).ToList();

        // Load items with non-archived containers & storage nodes
        var itemsWithContainers = await _dbContext.Items
            .AsNoTracking()
            .Include(i => i.Container)
            .ThenInclude(c => c.StorageNode)
            .Where(i => itemIds.Contains(i.Id) && i.WorkspaceId == workspaceId && !i.IsArchived && !i.Container.IsArchived)
            .ToListAsync(cancellationToken);

        var results = new List<SearchResultDto>();

        foreach (var item in itemsWithContainers)
        {
            var (locationId, locationName, breadcrumbSegments, breadcrumbDisplay) = await ResolveLocationBreadcrumbAsync(identity, workspaceId, item.Container.StorageNodeId, item.Container.StorageNode?.Name, cancellationToken);

            var boxDisplayId = item.Container.BoxNumber < 1000 ? $"BOX {item.Container.BoxNumber:D3}" : $"BOX {item.Container.BoxNumber}";

            results.Add(new SearchResultDto
            {
                ResultType = "ITEM",
                ItemId = item.Id,
                ItemName = item.Name,
                Quantity = item.Quantity,
                ContainerId = item.ContainerId,
                BoxNumber = item.Container.BoxNumber,
                BoxDisplayId = boxDisplayId,
                LocationId = locationId,
                LocationName = locationName,
                Breadcrumb = breadcrumbSegments,
                BreadcrumbDisplay = breadcrumbDisplay
            });
        }

        return results;
    }

    private async Task<(Guid? locationId, string? locationName, IReadOnlyList<string> breadcrumbSegments, string breadcrumbDisplay)> ResolveLocationBreadcrumbAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid storageNodeId,
        string? storageNodeName,
        CancellationToken cancellationToken)
    {
        if (storageNodeId == Guid.Empty)
        {
            return (null, null, Array.Empty<string>(), string.Empty);
        }

        try
        {
            var breadcrumbDto = await _breadcrumbService.GetBreadcrumbAsync(identity, workspaceId, storageNodeId, cancellationToken);
            var segments = breadcrumbDto.Segments.Select(s => s.Name).ToList();
            return (storageNodeId, storageNodeName, segments, breadcrumbDto.DisplayPath);
        }
        catch
        {
            var name = storageNodeName ?? string.Empty;
            return (storageNodeId, storageNodeName, new[] { name }, name);
        }
    }
}
