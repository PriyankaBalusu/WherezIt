using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class StorageLocationMoveIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public StorageLocationMoveIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task MoveLocation_ValidMoveAndMoveToRoot_Succeeds()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var moveService = scope.ServiceProvider.GetRequiredService<ILocationMoveService>();

        var identity = new AuthenticatedIdentity($"move_uid_{Guid.NewGuid():N}", "move@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Move Workspace"));

        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var basement = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Basement", null));
        var box = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Tote 1", garage.Id));

        // Move Tote 1 from Garage to Basement
        var movedBox = await moveService.MoveLocationAsync(identity, workspace.Id, box.Id, new MoveStorageLocationRequestDto(basement.Id));
        Assert.Equal(basement.Id, movedBox.ParentId);

        // Move Tote 1 to Root
        var rootBox = await moveService.MoveLocationAsync(identity, workspace.Id, box.Id, new MoveStorageLocationRequestDto(null));
        Assert.Null(rootBox.ParentId);
    }

    [Fact]
    public async Task MoveLocation_SelfAndDescendantCycle_IsRejected()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var moveService = scope.ServiceProvider.GetRequiredService<ILocationMoveService>();

        var identity = new AuthenticatedIdentity($"cycle_uid_{Guid.NewGuid():N}", "cycle@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Cycle Workspace"));

        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var rack = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Rack A", garage.Id));
        var shelf = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Shelf 1", rack.Id));

        // 1. Attempt self-move (Garage under Garage)
        var selfEx = await Assert.ThrowsAsync<ArgumentException>(() =>
            moveService.MoveLocationAsync(identity, workspace.Id, garage.Id, new MoveStorageLocationRequestDto(garage.Id)));
        Assert.Contains("Cannot move a location under itself.", selfEx.Message);

        // 2. Attempt descendant cycle (Garage under Shelf 1)
        var cycleEx = await Assert.ThrowsAsync<ArgumentException>(() =>
            moveService.MoveLocationAsync(identity, workspace.Id, garage.Id, new MoveStorageLocationRequestDto(shelf.Id)));
        Assert.Contains("Cannot move a location under one of its descendants.", cycleEx.Message);

        // Verify hierarchy remains untouched
        var garageUnchanged = await locationService.GetLocationAsync(identity, workspace.Id, garage.Id);
        Assert.Null(garageUnchanged.ParentId);
    }

    [Fact]
    public async Task MoveLocation_CrossWorkspaceAndNonMember_IsRejected()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var moveService = scope.ServiceProvider.GetRequiredService<ILocationMoveService>();

        var identityA = new AuthenticatedIdentity($"user_a_move_{Guid.NewGuid():N}", "usera@move.com", true);
        var identityB = new AuthenticatedIdentity($"user_b_move_{Guid.NewGuid():N}", "userb@move.com", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(identityA, new CreateWorkspaceRequestDto("WS A"));
        var wsB = await workspaceService.CreateWorkspaceAsync(identityB, new CreateWorkspaceRequestDto("WS B"));

        var nodeA = await locationService.CreateLocationAsync(identityA, wsA.Id, new CreateStorageLocationRequestDto("Node A", null));
        var nodeB = await locationService.CreateLocationAsync(identityB, wsB.Id, new CreateStorageLocationRequestDto("Node B", null));

        // Attempt cross-workspace move (moving Node A under Node B)
        await Assert.ThrowsAsync<ArgumentException>(() =>
            moveService.MoveLocationAsync(identityA, wsA.Id, nodeA.Id, new MoveStorageLocationRequestDto(nodeB.Id)));

        // Attempt move by non-member (User B trying to move Node A in WS A)
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            moveService.MoveLocationAsync(identityB, wsA.Id, nodeA.Id, new MoveStorageLocationRequestDto(null)));
    }
}
