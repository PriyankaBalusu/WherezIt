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
using WherezIt.Infrastructure.Services;
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
    public async Task SearchVocabulary_SupportsPhraseResolution_Normalizer_AndStrengths()
    {
        // 1. Multi-word phrase resolution
        var extCordMatches = SearchVocabulary.FindConceptsForPhrase("extension cord");
        Assert.NotEmpty(extCordMatches);
        Assert.Equal("CABLES_POWER", extCordMatches[0].Concept.Key);

        var sleepBagMatches = SearchVocabulary.FindConceptsForPhrase("sleeping bag");
        Assert.NotEmpty(sleepBagMatches);
        Assert.Equal("CAMPING", sleepBagMatches[0].Concept.Key);

        var babyBottleMatches = SearchVocabulary.FindConceptsForPhrase("baby bottle");
        Assert.NotEmpty(babyBottleMatches);
        Assert.Equal("BABY", babyBottleMatches[0].Concept.Key);

        var boardGameMatches = SearchVocabulary.FindConceptsForPhrase("board game");
        Assert.NotEmpty(boardGameMatches);
        Assert.Equal("TOYS_GAMES", boardGameMatches[0].Concept.Key);

        var wallArtMatches = SearchVocabulary.FindConceptsForPhrase("wall art");
        Assert.NotEmpty(wallArtMatches);
        Assert.Equal("HOME_DECOR", wallArtMatches[0].Concept.Key);

        // 2. Plural Normalization and Exceptions
        Assert.Equal("shoe", SearchTextNormalizer.NormalizeTerm("shoes"));
        Assert.Equal("boot", SearchTextNormalizer.NormalizeTerm("boots"));
        Assert.Equal("plate", SearchTextNormalizer.NormalizeTerm("plates"));
        Assert.Equal("document", SearchTextNormalizer.NormalizeTerm("documents"));
        
        Assert.Equal("jeans", SearchTextNormalizer.NormalizeTerm("jeans"));
        Assert.Equal("pants", SearchTextNormalizer.NormalizeTerm("pants"));
        Assert.Equal("christmas", SearchTextNormalizer.NormalizeTerm("christmas"));
        Assert.Equal("electronics", SearchTextNormalizer.NormalizeTerm("electronics"));

        // 3. Concept Specificity / Strength
        var tentMatches = SearchVocabulary.FindConceptsForPhrase("tent");
        var outdoorMatches = SearchVocabulary.FindConceptsForPhrase("outdoor");
        Assert.NotEmpty(tentMatches);
        Assert.NotEmpty(outdoorMatches);
        Assert.True(tentMatches[0].Strength > outdoorMatches[0].Strength);
    }

    [Fact]
    public async Task WorkspaceSearch_DisambiguatesContextualOverlap()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"overlap_user_{Guid.NewGuid():N}", "overlap@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Overlap WS"));
        var utility = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Utility Room", null));

        // Create containers
        var c1 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(utility.Id, "Box 101", null));
        var c2 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(utility.Id, "Box 102", null));
        var c3 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(utility.Id, "Box 103", null));
        var c4 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(utility.Id, "Box 104", null));

        (await db.Containers.FindAsync(c1.Id))!.BoxNumber = 101;
        (await db.Containers.FindAsync(c2.Id))!.BoxNumber = 102;
        (await db.Containers.FindAsync(c3.Id))!.BoxNumber = 103;
        (await db.Containers.FindAsync(c4.Id))!.BoxNumber = 104;
        await db.SaveChangesAsync();

        // 1. Cleaning vs Laundry
        await itemService.CreateItemAsync(identity, ws.Id, c1.Id, new CreateItemRequestDto("Laundry Detergent", 1));
        await itemService.CreateItemAsync(identity, ws.Id, c2.Id, new CreateItemRequestDto("Kitchen Cleaner", 1));
        await itemService.CreateItemAsync(identity, ws.Id, c3.Id, new CreateItemRequestDto("Laundry Basket", 1));
        await itemService.CreateItemAsync(identity, ws.Id, c4.Id, new CreateItemRequestDto("Mop", 1));

        var laundryResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "laundry detergent");
        Assert.NotEmpty(laundryResults);
        Assert.Equal(101, laundryResults[0].BoxNumber); // Laundry Detergent 1st

        // 2. Travel vs Documents
        var c5 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(utility.Id, "Box 105", null));
        var c6 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(utility.Id, "Box 106", null));
        (await db.Containers.FindAsync(c5.Id))!.BoxNumber = 105;
        (await db.Containers.FindAsync(c6.Id))!.BoxNumber = 106;
        await db.SaveChangesAsync();

        await itemService.CreateItemAsync(identity, ws.Id, c5.Id, new CreateItemRequestDto("Passport", 1));
        await itemService.CreateItemAsync(identity, ws.Id, c6.Id, new CreateItemRequestDto("Tax Documents", 1));

        var travelDocResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "travel documents");
        Assert.NotEmpty(travelDocResults);
        Assert.Equal(105, travelDocResults[0].BoxNumber); // Passport ranks 1st over Tax Documents

        // 3. Camping + Lighting
        var c7 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(utility.Id, "Box 107", null));
        var c8 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(utility.Id, "Box 108", null));
        (await db.Containers.FindAsync(c7.Id))!.BoxNumber = 107;
        (await db.Containers.FindAsync(c8.Id))!.BoxNumber = 108;
        await db.SaveChangesAsync();

        await itemService.CreateItemAsync(identity, ws.Id, c7.Id, new CreateItemRequestDto("Camping Lantern", 1));
        await itemService.CreateItemAsync(identity, ws.Id, c8.Id, new CreateItemRequestDto("Desk Lamp", 1));

        var campLightResults = await searchService.SearchWorkspaceAsync(identity, ws.Id, "camping light");
        Assert.NotEmpty(campLightResults);
        Assert.Equal(107, campLightResults[0].BoxNumber); // Camping Lantern ranks 1st over Desk Lamp
    }

    [Fact]
    public async Task GlobalSearch_SearchesAuthorizedWorkspaces_AndEnforcesPermissionBoundaries()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var user1Identity = new AuthenticatedIdentity($"user1_gs_{Guid.NewGuid():N}", "user1_gs@example.com", true);
        var user2Identity = new AuthenticatedIdentity($"user2_gs_{Guid.NewGuid():N}", "user2_gs@example.com", true);

        // User 1 owns Workspace A and Workspace B
        var wsA = await workspaceService.CreateWorkspaceAsync(user1Identity, new CreateWorkspaceRequestDto("WS Alpha"));
        var wsB = await workspaceService.CreateWorkspaceAsync(user1Identity, new CreateWorkspaceRequestDto("WS Beta"));

        // User 2 owns Workspace C (unauthorized for User 1)
        var wsC = await workspaceService.CreateWorkspaceAsync(user2Identity, new CreateWorkspaceRequestDto("WS Gamma"));

        // Add locations
        var locA = await locationService.CreateLocationAsync(user1Identity, wsA.Id, new CreateStorageLocationRequestDto("Attic", null));
        var locB = await locationService.CreateLocationAsync(user1Identity, wsB.Id, new CreateStorageLocationRequestDto("Garage", null));
        var locC = await locationService.CreateLocationAsync(user2Identity, wsC.Id, new CreateStorageLocationRequestDto("Basement", null));

        // Create containers & items
        var boxA = await containerService.CreateContainerAsync(user1Identity, wsA.Id, new CreateContainerRequestDto(locA.Id, "Holiday Box A", null));
        (await db.Containers.FindAsync(boxA.Id))!.BoxNumber = 1;

        var boxB = await containerService.CreateContainerAsync(user1Identity, wsB.Id, new CreateContainerRequestDto(locB.Id, "Holiday Box B", null));
        (await db.Containers.FindAsync(boxB.Id))!.BoxNumber = 5;

        var boxC = await containerService.CreateContainerAsync(user2Identity, wsC.Id, new CreateContainerRequestDto(locC.Id, "Secret Box C", null));
        (await db.Containers.FindAsync(boxC.Id))!.BoxNumber = 9;

        await db.SaveChangesAsync();

        await itemService.CreateItemAsync(user1Identity, wsA.Id, boxA.Id, new CreateItemRequestDto("Christmas String Lights", 3));
        await itemService.CreateItemAsync(user1Identity, wsB.Id, boxB.Id, new CreateItemRequestDto("Christmas Ornaments", 12));
        await itemService.CreateItemAsync(user2Identity, wsC.Id, boxC.Id, new CreateItemRequestDto("Christmas Wreath", 1));

        // Global search for User 1
        var resultsUser1 = await searchService.SearchAuthorizedWorkspacesAsync(user1Identity, "christmas");

        Assert.NotEmpty(resultsUser1);
        Assert.Contains(resultsUser1, r => r.WorkspaceId == wsA.Id && r.WorkspaceName == "WS Alpha");
        Assert.Contains(resultsUser1, r => r.WorkspaceId == wsB.Id && r.WorkspaceName == "WS Beta");

        // Verify Workspace C (unauthorized for User 1) is STRICTLY EXCLUDED
        Assert.DoesNotContain(resultsUser1, r => r.WorkspaceId == wsC.Id);
        Assert.DoesNotContain(resultsUser1, r => r.ItemName == "Christmas Wreath");

        // Global search for User 2
        var resultsUser2 = await searchService.SearchAuthorizedWorkspacesAsync(user2Identity, "christmas");
        Assert.NotEmpty(resultsUser2);
        Assert.Single(resultsUser2);
        Assert.Equal(wsC.Id, resultsUser2[0].WorkspaceId);
        Assert.Equal("Christmas Wreath", resultsUser2[0].ItemName);
    }

    [Fact]
    public async Task SearchV2_Relevance_UnrelatedItemsInMatchingContainerAreExcluded()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"rel001_user_{Guid.NewGuid():N}", "rel001@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Rel WS"));
        var attic = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Attic", null));

        // Create Container: Holiday Decorations (allocated BOX 007)
        var box7 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(attic.Id, "Holiday Decorations", "Box for holiday decor"));
        var cEntity = await db.Containers.FindAsync(box7.Id);
        Assert.NotNull(cEntity);
        cEntity.BoxNumber = 7;
        await db.SaveChangesAsync();

        // Items inside BOX 007
        var item1 = await itemService.CreateItemAsync(identity, ws.Id, box7.Id, new CreateItemRequestDto("Christmas Lights", 1));
        var item2 = await itemService.CreateItemAsync(identity, ws.Id, box7.Id, new CreateItemRequestDto("Tree Ornaments", 1));
        var item3 = await itemService.CreateItemAsync(identity, ws.Id, box7.Id, new CreateItemRequestDto("Hairmax Ultima 9 Classic LaserComb", 1));
        var item4 = await itemService.CreateItemAsync(identity, ws.Id, box7.Id, new CreateItemRequestDto("Ironing board", 1));

        // Query: "Christmas decor"
        var results = await searchService.SearchWorkspaceAsync(identity, ws.Id, "Christmas decor");

        // Container BOX 007 should match as CONTAINER
        Assert.Contains(results, r => r.ResultType == "CONTAINER" && r.ContainerId == box7.Id);

        // Relevant items MUST qualify
        Assert.Contains(results, r => r.ResultType == "ITEM" && r.ItemId == item1.Id);
        Assert.Contains(results, r => r.ResultType == "ITEM" && r.ItemId == item2.Id);

        // Irrelevant items MUST be EXCLUDED despite living in matching BOX 007
        Assert.DoesNotContain(results, r => r.ResultType == "ITEM" && r.ItemId == item3.Id);
        Assert.DoesNotContain(results, r => r.ResultType == "ITEM" && r.ItemId == item4.Id);
    }

    [Fact]
    public async Task SearchV2_ParentContainerMatchProvidesRankingBoostToQualifiedItems()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();

        var identity = new AuthenticatedIdentity($"boost001_user_{Guid.NewGuid():N}", "boost001@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Boost WS"));
        var basement = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Basement", null));

        var holidayBox = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(basement.Id, "Holiday Decorations", null));
        var electricalBox = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(basement.Id, "Electrical Supplies", null));

        var holidayLights = await itemService.CreateItemAsync(identity, ws.Id, holidayBox.Id, new CreateItemRequestDto("String Lights", 1));
        var electricalLights = await itemService.CreateItemAsync(identity, ws.Id, electricalBox.Id, new CreateItemRequestDto("String Lights", 1));

        // Query: "Christmas lights"
        var results = await searchService.SearchWorkspaceAsync(identity, ws.Id, "Christmas lights");

        var itemResults = results.Where(r => r.ResultType == "ITEM").ToList();
        Assert.Equal(2, itemResults.Count);

        // String Lights in Holiday Decorations MUST rank higher than String Lights in Electrical Supplies
        Assert.Equal(holidayLights.Id, itemResults[0].ItemId);
        Assert.Equal(electricalLights.Id, itemResults[1].ItemId);
    }

    [Fact]
    public async Task SearchV2_ExplicitLocationQueryQualifiesItemsInLocation()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();

        var identity = new AuthenticatedIdentity($"locq001_user_{Guid.NewGuid():N}", "locq001@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Loc WS"));
        var garage = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Garage", null));
        var box = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(garage.Id, "General Storage", null));

        var hammer = await itemService.CreateItemAsync(identity, ws.Id, box.Id, new CreateItemRequestDto("Hammer", 1));

        // Explicit location query: "items in garage"
        var results = await searchService.SearchWorkspaceAsync(identity, ws.Id, "items in garage");

        Assert.NotEmpty(results);
        Assert.Contains(results, r => r.ResultType == "ITEM" && r.ItemId == hammer.Id);
    }

    [Fact]
    public async Task SearchV2_ContainerOnlyMatch_DoesNotExpandChildItems()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();

        var identity = new AuthenticatedIdentity($"cont001_user_{Guid.NewGuid():N}", "cont001@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Cont WS"));
        var office = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Office", null));

        // Create Container: Tax Documents
        var taxBox = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(office.Id, "Tax Documents", "Box for tax files"));

        // Add unrelated child items to Tax Documents
        var hairDryer = await itemService.CreateItemAsync(identity, ws.Id, taxBox.Id, new CreateItemRequestDto("Hair Dryer", 1));
        var coffeeMug = await itemService.CreateItemAsync(identity, ws.Id, taxBox.Id, new CreateItemRequestDto("Coffee Mug", 1));

        // Query: "Tax Documents"
        var results = await searchService.SearchWorkspaceAsync(identity, ws.Id, "Tax Documents");

        // Container MUST be returned
        Assert.Contains(results, r => r.ResultType == "CONTAINER" && r.ContainerId == taxBox.Id && r.ContainerName == "Tax Documents");

        // Neither child item MUST be returned simply because their parent container matched
        Assert.DoesNotContain(results, r => r.ResultType == "ITEM" && r.ItemId == hairDryer.Id);
        Assert.DoesNotContain(results, r => r.ResultType == "ITEM" && r.ItemId == coffeeMug.Id);
    }
}

