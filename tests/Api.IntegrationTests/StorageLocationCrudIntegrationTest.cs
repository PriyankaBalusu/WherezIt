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
            locationService.CreateLocationAsync(identity2, ws2.Id, new CreateStorageLocationRequestDto("WS2 Child", ws1Node.Id)));
    }
}
