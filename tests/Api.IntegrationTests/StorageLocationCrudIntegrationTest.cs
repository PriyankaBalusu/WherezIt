using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class StorageLocationCrudIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public StorageLocationCrudIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task StorageLocation_CRUD_RootAndChildLocations_Succeeds()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();

        var identity = new AuthenticatedIdentity($"crud_uid_{Guid.NewGuid():N}", "crud@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("CRUD Workspace"));

        // Create Root Location
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        Assert.NotNull(garage);
        Assert.Equal("Garage", garage.Name);
        Assert.Null(garage.ParentId);

        // Create Child Location under Garage
        var rack = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Rack A", garage.Id));
        Assert.NotNull(rack);
        Assert.Equal("Rack A", rack.Name);
        Assert.Equal(garage.Id, rack.ParentId);

        // Rename Location
        var renamedRack = await locationService.RenameLocationAsync(identity, workspace.Id, rack.Id, new RenameStorageLocationRequestDto("Rack Main"));
        Assert.Equal("Rack Main", renamedRack.Name);

        // List Locations
        var locations = await locationService.GetLocationsAsync(identity, workspace.Id);
        Assert.Equal(2, locations.Count);

        // Delete Empty Child Location
        await locationService.DeleteLocationAsync(identity, workspace.Id, rack.Id);

        var locationsAfterDelete = await locationService.GetLocationsAsync(identity, workspace.Id);
        Assert.Single(locationsAfterDelete);
        Assert.Equal("Garage", locationsAfterDelete[0].Name);
    }

    [Fact]
    public async Task DeleteLocation_ParentWithChildren_FailsWithConflictException()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();

        var identity = new AuthenticatedIdentity($"del_conflict_{Guid.NewGuid():N}", "conflict@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Delete Conflict WS"));

        var parent = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Parent Node", null));
        var child = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Child Node", parent.Id));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            locationService.DeleteLocationAsync(identity, workspace.Id, parent.Id));

        Assert.Contains("Cannot delete storage location because it contains child locations.", ex.Message);
    }

    [Fact]
    public async Task DeleteLocation_LocationWithBoxes_FailsWithConflictException()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();

        var identity = new AuthenticatedIdentity($"del_box_conflict_{Guid.NewGuid():N}", "boxconflict@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Delete Box Conflict WS"));

        var location = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Storage Room", null));
        var box = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(location.Id, "Tool Box", null));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            locationService.DeleteLocationAsync(identity, workspace.Id, location.Id));

        Assert.Contains("Cannot delete storage location because it contains boxes.", ex.Message);
    }

    [Fact]
    public async Task LocationCrud_InvalidNameAndCrossWorkspaceParent_FailsValidation()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();

        var identity1 = new AuthenticatedIdentity($"valid_uid1_{Guid.NewGuid():N}", "val1@example.com", true);
        var identity2 = new AuthenticatedIdentity($"valid_uid2_{Guid.NewGuid():N}", "val2@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity1, new CreateWorkspaceRequestDto("WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity2, new CreateWorkspaceRequestDto("WS 2"));

        var ws1Node = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("WS1 Root", null));

        // Attempt blank name
        await Assert.ThrowsAsync<ArgumentException>(() =>
            locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("   ", null)));

        // Attempt >100 char name
        var longName = new string('B', 101);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto(longName, null)));

        // Attempt cross-workspace parent
        await Assert.ThrowsAsync<ArgumentException>(() =>
            locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Cross Node", ws1Node.Id)));
    }

    [Fact]
    public async Task CreateLocation_DuplicateSiblingNames_FailsValidation()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();

        var identity = new AuthenticatedIdentity($"dup_loc_{Guid.NewGuid():N}", "dup@example.com", true);
        var ws1 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Dup WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Dup WS 2"));

        var parentGarage = await locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("Garage", null));
        var parentBedroom = await locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("Bedroom", null));

        // 1. Child location creation under same parent
        await locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("Shelf A", parentGarage.Id));

        // 2. Duplicate under same parent with case variation should fail
        var ex1 = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("shelf a ", parentGarage.Id)));
        Assert.Contains("already exists under this location", ex1.Message);

        // 3. Same child name under DIFFERENT parent should succeed
        var shelfInBedroom = await locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("Shelf A", parentBedroom.Id));
        Assert.NotNull(shelfInBedroom);

        // 4. Duplicate root location in same workspace should fail
        var ex2 = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("garage", null)));
        Assert.Contains("already exists in this Storage Space", ex2.Message);

        // 5. Same root location name in DIFFERENT workspace should succeed
        var garageInWs2 = await locationService.CreateLocationAsync(identity, ws2.Id, new CreateStorageLocationRequestDto("Garage", null));
        Assert.NotNull(garageInWs2);

        // 6. Rename sibling to an existing sibling name should fail
        var shelfB = await locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("Shelf B", parentGarage.Id));
        var ex3 = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            locationService.RenameLocationAsync(identity, ws1.Id, shelfB.Id, new RenameStorageLocationRequestDto("Shelf A")));
        Assert.Contains("already exists under this location", ex3.Message);
    }
}
