using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.ActivityHistory.Services;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
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

public class ItemCrudIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public ItemCrudIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task CreateItem_ManualItem_ExplicitlyWritesManualSourceAndVerifiedTrue()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"item_user_{Guid.NewGuid():N}", "itemuser@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Item Test WS"));
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var container = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Tool Box", null));

        var itemDto = await itemService.CreateItemAsync(identity, workspace.Id, container.Id, new CreateItemRequestDto("Drill Set", 2));

        Assert.NotNull(itemDto);
        Assert.Equal("Drill Set", itemDto.Name);
        Assert.Equal(2, itemDto.Quantity);
        Assert.Equal("MANUAL", itemDto.Source);
        Assert.True(itemDto.IsVerified);
        Assert.False(itemDto.IsArchived);

        // Verify directly in DB
        var dbItem = await dbContext.Items.AsNoTracking().FirstOrDefaultAsync(i => i.Id == itemDto.Id);
        Assert.NotNull(dbItem);
        Assert.Equal("MANUAL", dbItem.Source);
        Assert.True(dbItem.IsVerified);
    }

    [Fact]
    public async Task CreateItem_WithNullCategory_SucceedsAndLogsItemAddedHistory()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();

        var identity = new AuthenticatedIdentity($"null_cat_user_{Guid.NewGuid():N}", "nullcat@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Null Cat WS"));
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var container = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Clothes Box", null));

        // Create item with no category (null/empty) and quantity 1
        var item = await itemService.CreateItemAsync(identity, workspace.Id, container.Id, new CreateItemRequestDto("Jackets", 1, null));

        Assert.NotNull(item);
        Assert.Equal("Jackets", item.Name);
        Assert.Equal(1, item.Quantity);

        // Verify ActivityHistory
        var history = await historyService.GetContainerHistoryAsync(identity, workspace.Id, container.Id);
        var addedEvent = history.FirstOrDefault(h => h.ActivityType == "ITEM_ADDED");
        Assert.NotNull(addedEvent);
        Assert.Equal("Item added", addedEvent.Title);
        Assert.Equal("Jackets · Qty 1", addedEvent.Description);
    }

    [Fact]
    public async Task CreateItem_WithCategory_SucceedsAndLogsItemAddedHistory()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();

        var identity = new AuthenticatedIdentity($"with_cat_user_{Guid.NewGuid():N}", "withcat@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Category WS"));
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var container = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Shoe Box", null));

        var item = await itemService.CreateItemAsync(identity, workspace.Id, container.Id, new CreateItemRequestDto("Nike Sneakers", 2, "Footwear"));

        Assert.NotNull(item);
        Assert.Equal("Nike Sneakers", item.Name);
        Assert.Equal(2, item.Quantity);

        // Verify ActivityHistory
        var history = await historyService.GetContainerHistoryAsync(identity, workspace.Id, container.Id);
        var addedEvent = history.FirstOrDefault(h => h.ActivityType == "ITEM_ADDED");
        Assert.NotNull(addedEvent);
        Assert.Equal("Item added", addedEvent.Title);
        Assert.Equal("Nike Sneakers · Qty 2", addedEvent.Description);
    }

    [Fact]
    public async Task DeleteItem_WritesItemRemovedHistoryAndPreservesSnapshot()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"del_item_user_{Guid.NewGuid():N}", "delitem@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Delete Item WS"));
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var container = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Box", null));

        var item = await itemService.CreateItemAsync(identity, workspace.Id, container.Id, new CreateItemRequestDto("Old Jacket", 1));

        await itemService.ArchiveItemAsync(identity, workspace.Id, item.Id);
        await itemService.DeleteItemAsync(identity, workspace.Id, item.Id);

        // Assert item row is deleted from database
        var dbItem = await dbContext.Items.FindAsync(item.Id);
        Assert.Null(dbItem);

        // Assert ITEM_REMOVED exists in history and snapshot survives deletion
        var history = await historyService.GetContainerHistoryAsync(identity, workspace.Id, container.Id);
        var removedEvent = history.FirstOrDefault(h => h.ActivityType == "ITEM_REMOVED");
        Assert.NotNull(removedEvent);
        Assert.Equal("Item removed", removedEvent.Title);
        Assert.Equal("Old Jacket · Qty 1", removedEvent.Description);
    }

    [Fact]
    public async Task ArchiveItem_ActiveItem_SetsIsArchivedTrueLogsItemArchivedHistoryAndIsIdempotent()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();

        var identity = new AuthenticatedIdentity($"archive_item_user_{Guid.NewGuid():N}", "archuser@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Archive Item WS"));
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var container = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Storage Box", null));
        var item = await itemService.CreateItemAsync(identity, workspace.Id, container.Id, new CreateItemRequestDto("Winter Coat", 1));

        // Archive item
        var archivedItem = await itemService.ArchiveItemAsync(identity, workspace.Id, item.Id);

        Assert.True(archivedItem.IsArchived);

        // Verify ITEM_ARCHIVED ActivityHistory entry was written
        var history = await historyService.GetContainerHistoryAsync(identity, workspace.Id, container.Id);
        var archivedEvent = history.FirstOrDefault(h => h.ActivityType == "ITEM_ARCHIVED");
        Assert.NotNull(archivedEvent);
        Assert.Equal("Item archived", archivedEvent.Title);
        Assert.Equal("Winter Coat · Qty 1", archivedEvent.Description);

        // Call ArchiveItemAsync again to verify idempotency
        var reArchivedItem = await itemService.ArchiveItemAsync(identity, workspace.Id, item.Id);
        Assert.True(reArchivedItem.IsArchived);

        // Restore item (Logs ITEM_RESTORED)
        var restoredItem = await itemService.RestoreItemAsync(identity, workspace.Id, item.Id);
        Assert.False(restoredItem.IsArchived);

        var restoredHistory = await historyService.GetContainerHistoryAsync(identity, workspace.Id, container.Id);
        var restoredEvent = restoredHistory.FirstOrDefault(h => h.ActivityType == "ITEM_RESTORED");
        Assert.NotNull(restoredEvent);
        Assert.Equal("Winter Coat · Qty 1", restoredEvent.Description);

        // Re-archive and Delete item (Logs ITEM_REMOVED)
        await itemService.ArchiveItemAsync(identity, workspace.Id, item.Id);
        await itemService.DeleteItemAsync(identity, workspace.Id, item.Id);

        var deletedHistory = await historyService.GetContainerHistoryAsync(identity, workspace.Id, container.Id);
        var removedEvent = deletedHistory.FirstOrDefault(h => h.ActivityType == "ITEM_REMOVED");
        Assert.NotNull(removedEvent);
        Assert.Equal("Winter Coat · Qty 1", removedEvent.Description);
    }
}
