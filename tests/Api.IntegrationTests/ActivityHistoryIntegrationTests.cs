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
}
