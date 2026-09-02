using System;
using System.Threading.Tasks;
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
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class FieldLengthValidationIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public FieldLengthValidationIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task WorkspaceName_MaxLength_EnforcedOnCreateAndRename()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();

        var identity = new AuthenticatedIdentity($"ws_len_owner_{Guid.NewGuid():N}", "ws_len@example.com", true);

        // 1. Exactly 100 chars accepted
        var name100 = new string('A', 100);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto(name100));
        Assert.NotNull(ws);
        Assert.Equal(name100, ws.Name);

        // 2. 101 chars rejected on create (throws ArgumentException, no 500 / DbUpdateException)
        var name101 = new string('B', 101);
        var exCreate = await Assert.ThrowsAsync<ArgumentException>(() =>
            workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto(name101)));
        Assert.Contains("100", exCreate.Message);

        // 3. 101 chars rejected on rename
        var exRename = await Assert.ThrowsAsync<ArgumentException>(() =>
            workspaceService.RenameWorkspaceAsync(identity, ws.Id, name101));
        Assert.Contains("100", exRename.Message);
    }

    [Fact]
    public async Task LocationName_MaxLength_EnforcedOnCreateAndRename()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();

        var identity = new AuthenticatedIdentity($"loc_len_owner_{Guid.NewGuid():N}", "loc_len@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Loc Len Space"));

        // 1. Exactly 100 chars accepted
        var name100 = new string('L', 100);
        var loc = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto(name100, null));
        Assert.Equal(name100, loc.Name);

        // 2. 101 chars rejected on create
        var name101 = new string('L', 101);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto(name101, null)));

        // 3. 101 chars rejected on rename
        await Assert.ThrowsAsync<ArgumentException>(() =>
            locationService.RenameLocationAsync(identity, ws.Id, loc.Id, new RenameStorageLocationRequestDto(name101)));
    }

    [Fact]
    public async Task Container_NameDescriptionLabel_MaxLength_EnforcedOnCreateAndUpdate()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();

        var identity = new AuthenticatedIdentity($"box_len_owner_{Guid.NewGuid():N}", "box_len@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Box Len Space"));
        var loc = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Base Loc", null));

        // 1. 100 char name & 500 char desc accepted
        var boxName100 = new string('B', 100);
        var boxDesc500 = new string('D', 500);
        var box = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(loc.Id, boxName100, boxDesc500, "Label 1"));
        Assert.Equal(boxName100, box.Name);
        Assert.Equal(boxDesc500, box.Description);

        // 2. 101 char box name rejected
        await Assert.ThrowsAsync<ArgumentException>(() =>
            containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(loc.Id, new string('X', 101))));

        // 3. 501 char description rejected
        await Assert.ThrowsAsync<ArgumentException>(() =>
            containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(loc.Id, "Valid", new string('Y', 501))));

        // 4. Update box rejects over-length fields
        await Assert.ThrowsAsync<ArgumentException>(() =>
            containerService.UpdateContainerAsync(identity, ws.Id, box.Id, new UpdateContainerRequestDto(null, null, new string('Z', 101))));
    }

    [Fact]
    public async Task Item_NameCategory_MaxLength_EnforcedOnCreateAndUpdate()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();

        var identity = new AuthenticatedIdentity($"item_len_owner_{Guid.NewGuid():N}", "item_len@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Item Len Space"));
        var loc = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Item Loc", null));
        var box = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(loc.Id, "Item Box"));

        // 1. 100 char item name & 50 char category accepted
        var itemName100 = new string('I', 100);
        var cat50 = new string('C', 50);
        var item = await itemService.CreateItemAsync(identity, ws.Id, box.Id, new CreateItemRequestDto(itemName100, 1, cat50));
        Assert.Equal(itemName100, item.Name);
        Assert.Equal(cat50, item.Category);

        // 2. 101 char item name rejected
        await Assert.ThrowsAsync<ArgumentException>(() =>
            itemService.CreateItemAsync(identity, ws.Id, box.Id, new CreateItemRequestDto(new string('X', 101), 1)));

        // 3. 51 char category rejected
        await Assert.ThrowsAsync<ArgumentException>(() =>
            itemService.CreateItemAsync(identity, ws.Id, box.Id, new CreateItemRequestDto("Valid Item", 1, new string('Y', 51))));

        // 4. Update item rejects over-length fields
        await Assert.ThrowsAsync<ArgumentException>(() =>
            itemService.UpdateItemAsync(identity, ws.Id, item.Id, new UpdateItemRequestDto(new string('Z', 101))));
    }
}
