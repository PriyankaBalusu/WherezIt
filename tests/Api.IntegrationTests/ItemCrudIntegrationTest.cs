using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
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
    public async Task CreateItem_QuantityLessThanOne_IsRejected()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();

        var identity = new AuthenticatedIdentity($"qty_user_{Guid.NewGuid():N}", "qtyuser@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Qty Test WS"));
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var container = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Box", null));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            itemService.CreateItemAsync(identity, workspace.Id, container.Id, new CreateItemRequestDto("Zero Qty", 0)));

        await Assert.ThrowsAsync<ArgumentException>(() =>
            itemService.CreateItemAsync(identity, workspace.Id, container.Id, new CreateItemRequestDto("Negative Qty", -5)));
    }

    [Fact]
    public async Task CreateItem_ArchivedContainer_IsRejectedWithConflict()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();

        var identity = new AuthenticatedIdentity($"arch_item_user_{Guid.NewGuid():N}", "architem@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Archived Box Item WS"));
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var container = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Archived Box", null));
        await containerService.ArchiveContainerAsync(identity, workspace.Id, container.Id);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            itemService.CreateItemAsync(identity, workspace.Id, container.Id, new CreateItemRequestDto("Item in Archived Box", 1)));

        Assert.Contains("Cannot create an item in an archived container.", ex.Message);
    }

    [Fact]
    public async Task Item_CrossWorkspaceContainerAssignment_FailsAtDatabaseLevel()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identityA = new AuthenticatedIdentity($"item_ws_a_{Guid.NewGuid():N}", "itemwsa@example.com", true);
        var identityB = new AuthenticatedIdentity($"item_ws_b_{Guid.NewGuid():N}", "itemwsb@example.com", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(identityA, new CreateWorkspaceRequestDto("Item WS A"));
        var wsB = await workspaceService.CreateWorkspaceAsync(identityB, new CreateWorkspaceRequestDto("Item WS B"));

        var nodeA = await locationService.CreateLocationAsync(identityA, wsA.Id, new CreateStorageLocationRequestDto("Node A", null));
        var containerA = await containerService.CreateContainerAsync(identityA, wsA.Id, new CreateContainerRequestDto(nodeA.Id, "Box A", null));

        // Attempt DB insertion of Item belonging to Workspace B but pointing to Container A (belonging to Workspace A)
        var invalidItem = new Item
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsB.Id, // Mismatched workspace!
            ContainerId = containerA.Id,
            Name = "Mismatched Item",
            Quantity = 1,
            Source = "MANUAL",
            IsVerified = true,
            IsArchived = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Items.Add(invalidItem);
        await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
    }

    [Fact]
    public async Task Item_ArchiveAndRestore_PreservesTrustedMetadata()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();

        var identity = new AuthenticatedIdentity($"arch_rest_user_{Guid.NewGuid():N}", "archrest@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Archive Item WS"));
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var container = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Box", null));

        var item = await itemService.CreateItemAsync(identity, workspace.Id, container.Id, new CreateItemRequestDto("Extension Cord", 1));

        // Archive
        var archived = await itemService.ArchiveItemAsync(identity, workspace.Id, item.Id);
        Assert.True(archived.IsArchived);
        Assert.Equal("MANUAL", archived.Source);
        Assert.True(archived.IsVerified);

        // List default excludes archived
        var activeItems = await itemService.GetItemsByContainerAsync(identity, workspace.Id, container.Id, includeArchived: false);
        Assert.Empty(activeItems);

        // List includeArchived includes it
        var allItems = await itemService.GetItemsByContainerAsync(identity, workspace.Id, container.Id, includeArchived: true);
        Assert.Single(allItems);

        // Restore
        var restored = await itemService.RestoreItemAsync(identity, workspace.Id, item.Id);
        Assert.False(restored.IsArchived);
    }
}
