using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;
using WherezIt.Application.Search.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class SearchApiTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public SearchApiTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task WorkspaceSearch_HandlesItems_BoxQueries_Breadcrumbs_Archive_AndTenancy()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity1 = new AuthenticatedIdentity($"srch002_user_1_{Guid.NewGuid():N}", "srch002_1@example.com", true);
        var identity2 = new AuthenticatedIdentity($"srch002_user_2_{Guid.NewGuid():N}", "srch002_2@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity1, new CreateWorkspaceRequestDto("SRCH002 WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity2, new CreateWorkspaceRequestDto("SRCH002 WS 2"));

        // Setup Location Hierarchy in WS1: Garage -> Rack A -> Shelf 2
        var garage = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Garage", null));
        var rackA = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Rack A", garage.Id));
        var shelf2 = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Shelf 2", rackA.Id));

        // Create Container 4 in WS1 (allocated BOX 004 or similar, let's force box_number 4)
        var container4 = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(shelf2.Id, "Holiday Supplies", null));
        
        // Update box number explicitly for deterministic BOX 004 test
        var containerEntity = await db.Containers.FindAsync(container4.Id);
        Assert.NotNull(containerEntity);
        containerEntity.BoxNumber = 4;
        await db.SaveChangesAsync();

        // Create Item in Container 4
        var item = await itemService.CreateItemAsync(identity1, ws1.Id, container4.Id, new CreateItemRequestDto("Christmas Lights", 2));

        // 1. Ordinary Item Name FTS query -> returns ITEM result with breadcrumb
        var itemResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "Christmas lights");
        Assert.Single(itemResults);
        var firstItem = itemResults[0];
        Assert.Equal("ITEM", firstItem.ResultType);
        Assert.Equal(item.Id, firstItem.ItemId);
        Assert.Equal("Christmas Lights", firstItem.ItemName);
        Assert.Equal(2, firstItem.Quantity);
        Assert.Equal(container4.Id, firstItem.ContainerId);
        Assert.Equal(4, firstItem.BoxNumber);
        Assert.Equal("BOX 004", firstItem.BoxDisplayId);
        Assert.Equal("Garage → Rack A → Shelf 2", firstItem.BreadcrumbDisplay);

        // 2. BOX query "BOX 004" -> returns CONTAINER result
        var box004Results = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "BOX 004");
        Assert.Single(box004Results);
        var boxRes = box004Results[0];
        Assert.Equal("CONTAINER", boxRes.ResultType);
        Assert.Null(boxRes.ItemId);
        Assert.Null(boxRes.ItemName);
        Assert.Null(boxRes.Quantity);
        Assert.Equal(container4.Id, boxRes.ContainerId);
        Assert.Equal(4, boxRes.BoxNumber);
        Assert.Equal("BOX 004", boxRes.BoxDisplayId);
        Assert.Equal("Garage → Rack A → Shelf 2", boxRes.BreadcrumbDisplay);

        // 3. BOX query "4" -> returns CONTAINER result
        var box4Results = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "4");
        Assert.Single(box4Results);
        Assert.Equal("CONTAINER", box4Results[0].ResultType);
        Assert.Equal(4, box4Results[0].BoxNumber);

        // 4. Create empty container 12
        var container12 = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(garage.Id, "Empty Box", null));
        var c12Entity = await db.Containers.FindAsync(container12.Id);
        Assert.NotNull(c12Entity);
        c12Entity.BoxNumber = 12;
        await db.SaveChangesAsync();

        // Query BOX 012 with zero items -> returns CONTAINER with null item fields
        var box12Results = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "BOX 012");
        Assert.Single(box12Results);
        Assert.Equal("CONTAINER", box12Results[0].ResultType);
        Assert.Null(box12Results[0].ItemId);
        Assert.Equal("BOX 012", box12Results[0].BoxDisplayId);

        // 5. Tenant isolation -> WS2 identity searching WS1 workspace throws UnauthorizedAccessException
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            searchService.SearchWorkspaceAsync(identity2, ws1.Id, "Christmas"));

        // 6. Archived item exclusion
        await itemService.ArchiveItemAsync(identity1, ws1.Id, item.Id);
        var emptyItemResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "Christmas lights");
        Assert.Empty(emptyItemResults);
    }
}
