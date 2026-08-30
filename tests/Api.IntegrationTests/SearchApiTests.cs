using System;
using System.Linq;
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

        // Create Container 4 in WS1 (allocated BOX 004)
        var container4 = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(shelf2.Id, "Holiday Supplies", null));
        
        var containerEntity = await db.Containers.FindAsync(container4.Id);
        Assert.NotNull(containerEntity);
        containerEntity.BoxNumber = 4;
        await db.SaveChangesAsync();

        // Create Item in Container 4
        var item = await itemService.CreateItemAsync(identity1, ws1.Id, container4.Id, new CreateItemRequestDto("Christmas Lights", 2));

        // 1. Ordinary Item Name FTS query -> returns ITEM result with breadcrumb
        var itemResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "Christmas lights");
        Assert.NotEmpty(itemResults);
        var firstItem = itemResults[0];
        Assert.Equal("ITEM", firstItem.ResultType);
        Assert.Equal(item.Id, firstItem.ItemId);
        Assert.Equal("Christmas Lights", firstItem.ItemName);
        Assert.Equal(2, firstItem.Quantity);
        Assert.Equal(container4.Id, firstItem.ContainerId);
        Assert.Equal(4, firstItem.BoxNumber);
        Assert.Equal("BOX 004", firstItem.BoxDisplayId);
        Assert.Equal("SRCH002 WS 1 → Garage → Rack A → Shelf 2", firstItem.BreadcrumbDisplay);

        // 2. BOX query "BOX 004" -> returns CONTAINER result
        var box004Results = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "BOX 004");
        Assert.NotEmpty(box004Results);
        var boxRes = box004Results[0];
        Assert.Equal("CONTAINER", boxRes.ResultType);
        Assert.Equal(container4.Id, boxRes.ContainerId);
        Assert.Equal(4, boxRes.BoxNumber);
        Assert.Equal("BOX 004", boxRes.BoxDisplayId);
        Assert.Equal("SRCH002 WS 1 → Garage → Rack A → Shelf 2", boxRes.BreadcrumbDisplay);

        // 3. BOX query "4", "BOX#004", "BOX-004" -> returns CONTAINER result
        var box4Results = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "4");
        Assert.Equal(4, box4Results[0].BoxNumber);

        var boxHashResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "BOX#004");
        Assert.Equal(4, boxHashResults[0].BoxNumber);

        var boxDashResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "BOX-004");
        Assert.Equal(4, boxDashResults[0].BoxNumber);

        // 4. Partial / Prefix / Case-insensitive / Typo / No-result search cases
        var partialResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "Holid");
        Assert.NotEmpty(partialResults);
        Assert.Equal(container4.Id, partialResults[0].ContainerId);

        var caseInsensitiveResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "HOLIDAY SUPPLIES");
        Assert.NotEmpty(caseInsensitiveResults);

        var typoResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "Holiady");
        Assert.NotEmpty(typoResults);

        var noResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "NonExistentTermXYZ");
        Assert.Empty(noResults);

        // 5. Create empty container 12
        var container12 = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(garage.Id, "Empty Box", null));
        var c12Entity = await db.Containers.FindAsync(container12.Id);
        Assert.NotNull(c12Entity);
        c12Entity.BoxNumber = 12;
        await db.SaveChangesAsync();

        var box12Results = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "BOX 012");
        Assert.NotEmpty(box12Results);
        Assert.Equal("CONTAINER", box12Results[0].ResultType);
        Assert.Null(box12Results[0].ItemId);
        Assert.Equal("BOX 012", box12Results[0].BoxDisplayId);

        // 6. Tenant isolation -> WS2 identity searching WS1 workspace throws UnauthorizedAccessException
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            searchService.SearchWorkspaceAsync(identity2, ws1.Id, "Christmas"));

        // 7. Archived item exclusion
        await itemService.ArchiveItemAsync(identity1, ws1.Id, item.Id);
        var emptyItemResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "Christmas lights");
        Assert.Empty(emptyItemResults);
    }

    [Fact]
    public async Task WorkspaceSearch_SupportsNaturalLanguage_Synonyms_AndShortQueryRules()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"nl_user_{Guid.NewGuid():N}", "nl@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("NL Search WS"));

        // Garage -> Rack A -> Shelf 2
        var garage = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Garage", null));
        var rackA = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Rack A", garage.Id));
        var shelf2 = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Shelf 2", rackA.Id));

        // Create Container BOX 004 "Holiday Storage"
        var box4 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(shelf2.Id, "Holiday Storage", null));
        var b4Entity = await db.Containers.FindAsync(box4.Id);
        Assert.NotNull(b4Entity);
        b4Entity.BoxNumber = 4;
        await db.SaveChangesAsync();

        // Items inside BOX 004
        await itemService.CreateItemAsync(identity, ws.Id, box4.Id, new CreateItemRequestDto("Christmas ornaments", 5));
        await itemService.CreateItemAsync(identity, ws.Id, box4.Id, new CreateItemRequestDto("String lights", 2));
        await itemService.CreateItemAsync(identity, ws.Id, box4.Id, new CreateItemRequestDto("Wreath", 1));

        // Natural Language Scenario 1: "Where's my Christmas decor?" -> finds BOX 004
        var nlResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "Where's my Christmas decor?");
        Assert.NotEmpty(nlResults);
        Assert.Equal(4, nlResults[0].BoxNumber);
        Assert.Equal("BOX 004", nlResults[0].BoxDisplayId);

        // Natural Language Scenario 2: "xmas decorations" -> finds BOX 004
        var xmasResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "xmas decorations");
        Assert.NotEmpty(xmasResults);
        Assert.Equal(4, xmasResults[0].BoxNumber);

        // Natural Language Scenario 3: "where are my ornaments" -> finds BOX 004
        var ornamentResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "where are my ornaments");
        Assert.NotEmpty(ornamentResults);
        Assert.Equal(4, ornamentResults[0].BoxNumber);

        // Short Query Rule: "4" -> Box number candidate
        var shortBoxResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "4");
        Assert.NotEmpty(shortBoxResults);
        Assert.Equal(4, shortBoxResults[0].BoxNumber);

        // Short Query Rule: "bo" -> does not blow up into noisy fuzzy results
        var shortTextResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "bo");
        Assert.All(shortTextResults, r => Assert.True(r.BoxDisplayId.StartsWith("BOX", StringComparison.OrdinalIgnoreCase) || (r.ItemName?.StartsWith("bo", StringComparison.OrdinalIgnoreCase) ?? false)));
    }

    [Fact]
    public async Task WorkspaceSearch_DifferentiatesLiteralAndConceptCombinations_NikeShoesRegression()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"nike_user_{Guid.NewGuid():N}", "nike@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Nike Shoes WS"));

        var closet = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Master Closet", null));

        // Create Containers BOX 001 - BOX 006
        var c1 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(closet.Id, "Box 1", null));
        var c2 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(closet.Id, "Box 2", null));
        var c3 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(closet.Id, "Box 3", null));
        var c4 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(closet.Id, "Box 4", null));
        var c5 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(closet.Id, "Box 5", null));
        var c6 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(closet.Id, "Box 6", null));

        (await db.Containers.FindAsync(c1.Id))!.BoxNumber = 1;
        (await db.Containers.FindAsync(c2.Id))!.BoxNumber = 2;
        (await db.Containers.FindAsync(c3.Id))!.BoxNumber = 3;
        (await db.Containers.FindAsync(c4.Id))!.BoxNumber = 4;
        (await db.Containers.FindAsync(c5.Id))!.BoxNumber = 5;
        (await db.Containers.FindAsync(c6.Id))!.BoxNumber = 6;
        await db.SaveChangesAsync();

        // Items inside containers
        await itemService.CreateItemAsync(identity, ws.Id, c1.Id, new CreateItemRequestDto("Nike Running Shoes", 1));
        await itemService.CreateItemAsync(identity, ws.Id, c2.Id, new CreateItemRequestDto("Adidas Sneakers", 1));
        await itemService.CreateItemAsync(identity, ws.Id, c3.Id, new CreateItemRequestDto("Winter Boots", 1));
        await itemService.CreateItemAsync(identity, ws.Id, c4.Id, new CreateItemRequestDto("Nike Hiking Boots", 1));
        await itemService.CreateItemAsync(identity, ws.Id, c5.Id, new CreateItemRequestDto("Sandals", 2));
        await itemService.CreateItemAsync(identity, ws.Id, c6.Id, new CreateItemRequestDto("Nike Jacket", 1));

        // 1. Test Query: "shoes" -> BOX 1-5 returned (footwear), BOX 6 (Nike Jacket) excluded
        var shoesResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "shoes");
        var shoeBoxNums = shoesResults.Select(r => r.BoxNumber).ToList();
        Assert.Contains(1, shoeBoxNums);
        Assert.Contains(2, shoeBoxNums);
        Assert.Contains(3, shoeBoxNums);
        Assert.Contains(4, shoeBoxNums);
        Assert.Contains(5, shoeBoxNums);
        Assert.DoesNotContain(6, shoeBoxNums); // Non-footwear excluded

        // 2. Test Query: "nike shoes" -> BOX 1 (Nike Running Shoes) & BOX 4 (Nike Hiking Boots) rank at top
        var nikeShoesResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "nike shoes");
        Assert.True(nikeShoesResults.Count >= 2);
        Assert.Equal(1, nikeShoesResults[0].BoxNumber); // Nike Running Shoes 1st
        Assert.Equal(4, nikeShoesResults[1].BoxNumber); // Nike Hiking Boots 2nd

        // 3. Test Query: "winter shoes" -> BOX 3 (Winter Boots) ranks 1st
        var winterShoesResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "winter shoes");
        Assert.NotEmpty(winterShoesResults);
        Assert.Equal(3, winterShoesResults[0].BoxNumber);

        // 4. Test Query: "nike" -> BOX 1, 4, 6 all match literal brand
        var nikeResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "nike");
        var nikeBoxNums = nikeResults.Select(r => r.BoxNumber).ToList();
        Assert.Contains(1, nikeBoxNums);
        Assert.Contains(4, nikeBoxNums);
        Assert.Contains(6, nikeBoxNums);

        // 5. Test Query: "nike boots" -> BOX 4 (Nike Hiking Boots) 1st
        var nikeBootsResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "nike boots");
        Assert.NotEmpty(nikeBootsResults);
        Assert.Equal(4, nikeBootsResults[0].BoxNumber);
    }
}
