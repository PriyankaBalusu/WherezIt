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

public class SearchFoundationIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public SearchFoundationIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task SearchItems_MatchesNormalizedName_ExcludesArchived_EnforcesTenancy()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<ISearchService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity1 = new AuthenticatedIdentity($"srch_user_1_{Guid.NewGuid():N}", "srch1@example.com", true);
        var identity2 = new AuthenticatedIdentity($"srch_user_2_{Guid.NewGuid():N}", "srch2@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity1, new CreateWorkspaceRequestDto("Search WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity2, new CreateWorkspaceRequestDto("Search WS 2"));

        var loc1 = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Garage", null));
        var container1 = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(loc1.Id, "Box 10", null));

        var loc2 = await locationService.CreateLocationAsync(identity2, ws2.Id, new CreateStorageLocationRequestDto("Attic", null));
        var container2 = await containerService.CreateContainerAsync(identity2, ws2.Id, new CreateContainerRequestDto(loc2.Id, "Box 20", null));

        // Create trusted items in WS1
        var item1 = await itemService.CreateItemAsync(identity1, ws1.Id, container1.Id, new CreateItemRequestDto("Christmas Lights", 2));
        var item2 = await itemService.CreateItemAsync(identity1, ws1.Id, container1.Id, new CreateItemRequestDto("Power Drill", 1));

        // Create item in WS2 with same name
        var itemWs2 = await itemService.CreateItemAsync(identity2, ws2.Id, container2.Id, new CreateItemRequestDto("Christmas Lights", 5));

        // Create untrusted DetectionSuggestion in WS1
        var capture = new InventoryCapture
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            ContainerId = container1.Id,
            Status = "UPLOADED",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.InventoryCaptures.Add(capture);

        var suggestion = new DetectionSuggestion
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            CaptureId = capture.Id,
            Name = "Untrusted Christmas Ornaments",
            Quantity = 10,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.DetectionSuggestions.Add(suggestion);
        await db.SaveChangesAsync();

        // 1. Search for "christmas" in WS1 -> Should find "Christmas Lights" in WS1
        var results = await searchService.SearchItemsAsync(identity1, ws1.Id, "christmas");
        Assert.Single(results);
        Assert.Equal(item1.Id, results[0].Id);
        Assert.Equal("Christmas Lights", results[0].Name);

        // 2. Tenant isolation -> WS1 search MUST NOT return WS2 item or vice versa
        var resultsWs2 = await searchService.SearchItemsAsync(identity2, ws2.Id, "christmas");
        Assert.Single(resultsWs2);
        Assert.Equal(itemWs2.Id, resultsWs2[0].Id);
        Assert.NotEqual(results[0].Id, resultsWs2[0].Id);

        // 3. Untrusted DetectionSuggestions are NOT returned by search
        var suggestionSearch = await searchService.SearchItemsAsync(identity1, ws1.Id, "Ornaments");
        Assert.Empty(suggestionSearch);

        // 4. Archive exclusion
        await itemService.ArchiveItemAsync(identity1, ws1.Id, item1.Id);
        var activeSearch = await searchService.SearchItemsAsync(identity1, ws1.Id, "christmas");
        Assert.Empty(activeSearch);

        var includeArchivedSearch = await searchService.SearchItemsAsync(identity1, ws1.Id, "christmas", includeArchived: true);
        Assert.Single(includeArchivedSearch);
    }
}
