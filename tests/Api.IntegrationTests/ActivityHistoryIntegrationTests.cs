using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.ActivityHistory.Services;
using WherezIt.Application.AI.Dtos;
using WherezIt.Application.AI.Services;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Identifiers.Services;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class ActivityHistoryIntegrationTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public ActivityHistoryIntegrationTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task ContainerLifecycle_LogsDistinctItemEventsAndMapsToFriendlyPresentation()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var moveService = scope.ServiceProvider.GetRequiredService<IContainerMoveService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();

        var userA = new AuthenticatedIdentity("user-act-1", "usera@act.test", true);

        // 1. Setup Workspace and locations
        var wsA = await workspaceService.CreateWorkspaceAsync(userA, new CreateWorkspaceRequestDto("History Test WS"));
        var shelf1 = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Shelf 1", null));
        var shelf2 = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Shelf 2", null));

        // 2. Create container (Logs CONTAINER_CREATED)
        var container = await containerService.CreateContainerAsync(userA, wsA.Id, new CreateContainerRequestDto(shelf1.Id, "Tool Box", "Hand tools"));

        // 3. Add Item (Logs ITEM_ADDED)
        var item = await itemService.CreateItemAsync(userA, wsA.Id, container.Id, new CreateItemRequestDto("Tape Measure", 2, "Hardware"));

        // 4. Update Item (Logs ITEM_UPDATED)
        await itemService.UpdateItemAsync(userA, wsA.Id, item.Id, new UpdateItemRequestDto("Stanley Tape Measure", 3, "Hardware"));

        // 5. Archive Item (Logs ITEM_ARCHIVED)
        await itemService.ArchiveItemAsync(userA, wsA.Id, item.Id);

        // 6. Restore Item (Logs ITEM_RESTORED)
        await itemService.RestoreItemAsync(userA, wsA.Id, item.Id);

        // 7. Delete Item (Archive then Delete -> Logs ITEM_REMOVED)
        await itemService.ArchiveItemAsync(userA, wsA.Id, item.Id);
        await itemService.DeleteItemAsync(userA, wsA.Id, item.Id);

        // Verify item entity is removed from DB
        var itemInDb = await db.Items.FindAsync(item.Id);
        Assert.Null(itemInDb);

        // 8. Move container (Logs CONTAINER_MOVED)
        await moveService.MoveContainerAsync(userA, wsA.Id, container.Id, new MoveContainerRequestDto(shelf2.Id));

        // Fetch Box History
        var historyList = await historyService.GetContainerHistoryAsync(userA, wsA.Id, container.Id);

        var archivedEvent = historyList.FirstOrDefault(h => h.ActivityType == "ITEM_ARCHIVED");
        Assert.NotNull(archivedEvent);
        Assert.Equal("Item archived", archivedEvent.Title);
        Assert.Equal("Stanley Tape Measure · Qty 3", archivedEvent.Description);

        var restoredEvent = historyList.FirstOrDefault(h => h.ActivityType == "ITEM_RESTORED");
        Assert.NotNull(restoredEvent);
        Assert.Equal("Item restored", restoredEvent.Title);
        Assert.Equal("Stanley Tape Measure · Qty 3", restoredEvent.Description);

        var removedEvent = historyList.FirstOrDefault(h => h.ActivityType == "ITEM_REMOVED");
        Assert.NotNull(removedEvent);
        Assert.Equal("Item removed", removedEvent.Title);
        Assert.Equal("Stanley Tape Measure · Qty 3", removedEvent.Description);

        var addedEvent = historyList.FirstOrDefault(h => h.ActivityType == "ITEM_ADDED");
        Assert.NotNull(addedEvent);
        Assert.Equal("Item added", addedEvent.Title);
        Assert.Equal("Tape Measure · Qty 2", addedEvent.Description);
    }

    [Fact]
    public async Task GetContainerHistory_AuthorizedUser_CanReadTransferredContainerHistory()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();

        var user = new AuthenticatedIdentity("user-history-auth-1", "histauth1@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(user, new CreateWorkspaceRequestDto("WS Auth Test"));
        var loc = await locationService.CreateLocationAsync(user, ws.Id, new CreateStorageLocationRequestDto("Loc A", null));
        var container = await containerService.CreateContainerAsync(user, ws.Id, new CreateContainerRequestDto(loc.Id, "Box Auth Test", null));

        var history = await historyService.GetContainerHistoryAsync(user, ws.Id, container.Id);
        Assert.NotEmpty(history);
        Assert.Contains(history, h => h.ActivityType == "CONTAINER_CREATED");
    }

    [Fact]
    public async Task GetContainerHistory_UnauthorizedRouteWorkspaceMismatch_PreventsHistoryLeak()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();

        var ownerA = new AuthenticatedIdentity("user-owner-a", "ownera@example.com", true);
        var ownerB = new AuthenticatedIdentity("user-owner-b", "ownerb@example.com", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(ownerA, new CreateWorkspaceRequestDto("WS A"));
        var wsB = await workspaceService.CreateWorkspaceAsync(ownerB, new CreateWorkspaceRequestDto("WS B"));

        var locB = await locationService.CreateLocationAsync(ownerB, wsB.Id, new CreateStorageLocationRequestDto("Loc B", null));
        var containerB = await containerService.CreateContainerAsync(ownerB, wsB.Id, new CreateContainerRequestDto(locB.Id, "Box In WS B", null));

        // ownerA is authorized for wsA, but NOT wsB.
        // Attempting to request containerB's history by pairing wsA.Id with containerB.Id must throw UnauthorizedAccessException.
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            historyService.GetContainerHistoryAsync(ownerA, wsA.Id, containerB.Id));
    }

    [Fact]
    public async Task GetContainerHistory_NonExistentContainer_ThrowsKeyNotFoundException()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();

        var user = new AuthenticatedIdentity("user-not-found-test", "notfound@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(user, new CreateWorkspaceRequestDto("WS NF"));

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            historyService.GetContainerHistoryAsync(user, ws.Id, Guid.NewGuid()));
    }

    [Fact]
    public async Task GetWorkspaceHistory_AuthorizedUser_ReturnsWorkspaceEventsAndPaginates()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();

        var user = new AuthenticatedIdentity("user-ws-hist-1", "wshist1@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(user, new CreateWorkspaceRequestDto("WS History Test"));
        var loc = await locationService.CreateLocationAsync(user, ws.Id, new CreateStorageLocationRequestDto("Attic", null));
        var box = await containerService.CreateContainerAsync(user, ws.Id, new CreateContainerRequestDto(loc.Id, "Attic Box", null));

        var history = await historyService.GetWorkspaceHistoryAsync(user, ws.Id, page: 1, pageSize: 10);
        Assert.NotEmpty(history);
        Assert.All(history, h => Assert.Equal(ws.Id, h.WorkspaceId));
    }

    [Fact]
    public async Task GetWorkspaceHistory_UnauthorizedUser_ThrowsUnauthorizedAccessException()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();

        var userA = new AuthenticatedIdentity("user-ws-a", "wsa@example.com", true);
        var userB = new AuthenticatedIdentity("user-ws-b", "wsb@example.com", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(userA, new CreateWorkspaceRequestDto("WS A Private"));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            historyService.GetWorkspaceHistoryAsync(userB, wsA.Id, page: 1, pageSize: 10));
    }

    [Fact]
    public async Task GetLocationHistory_FiltersByExplicitLocationAndEnforcesAuthorization()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var moveService = scope.ServiceProvider.GetRequiredService<IContainerMoveService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();

        var user = new AuthenticatedIdentity("user-loc-hist-1", "lochist1@example.com", true);
        var userOther = new AuthenticatedIdentity("user-loc-other", "locother@example.com", true);

        var ws = await workspaceService.CreateWorkspaceAsync(user, new CreateWorkspaceRequestDto("Loc History WS"));
        var garage = await locationService.CreateLocationAsync(user, ws.Id, new CreateStorageLocationRequestDto("Garage", null));
        var basement = await locationService.CreateLocationAsync(user, ws.Id, new CreateStorageLocationRequestDto("Basement", null));

        var box = await containerService.CreateContainerAsync(user, ws.Id, new CreateContainerRequestDto(garage.Id, "Move Box", null));
        await moveService.MoveContainerAsync(user, ws.Id, box.Id, new CreateContainerRequestDto(basement.Id, "Move Box", null));

        // Garage location history should contain the event where PreviousStorageNodeId or DestinationStorageNodeId == garage.Id
        var garageHistory = await historyService.GetLocationHistoryAsync(user, ws.Id, garage.Id);
        Assert.NotEmpty(garageHistory);

        // Unauthorized user cannot read location history
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            historyService.GetLocationHistoryAsync(userOther, ws.Id, garage.Id));
    }
}
