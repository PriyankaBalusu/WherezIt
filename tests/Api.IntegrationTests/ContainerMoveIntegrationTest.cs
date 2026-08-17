using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class ContainerMoveIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public ContainerMoveIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task MoveContainer_AuthorizedSameWorkspace_SucceedsAndPreservesPermanentBoxId()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var moveService = scope.ServiceProvider.GetRequiredService<IContainerMoveService>();

        var identity = new AuthenticatedIdentity($"box_move_{Guid.NewGuid():N}", "boxmove@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Move Box WS"));

        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var basement = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Basement", null));

        var container = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Holiday Box", null));
        Assert.Equal("BOX 001", container.BoxId);
        Assert.Equal(garage.Id, container.StorageNodeId);

        // Move Container from Garage to Basement
        var movedContainer = await moveService.MoveContainerAsync(identity, workspace.Id, container.Id, new MoveContainerRequestDto(basement.Id));

        Assert.Equal(container.Id, movedContainer.Id);
        Assert.Equal(container.WorkspaceId, movedContainer.WorkspaceId);
        Assert.Equal(container.BoxNumber, movedContainer.BoxNumber);
        Assert.Equal("BOX 001", movedContainer.BoxId);
        Assert.Equal(basement.Id, movedContainer.StorageNodeId);
        Assert.Equal(container.CreatedAt, movedContainer.CreatedAt);
    }

    [Fact]
    public async Task MoveContainer_ArchivedContainer_IsRejectedWithConflict()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var moveService = scope.ServiceProvider.GetRequiredService<IContainerMoveService>();

        var identity = new AuthenticatedIdentity($"arch_move_{Guid.NewGuid():N}", "archmove@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Archived Move WS"));

        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var basement = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Basement", null));

        var container = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Archived Box", null));
        await containerService.ArchiveContainerAsync(identity, workspace.Id, container.Id);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            moveService.MoveContainerAsync(identity, workspace.Id, container.Id, new MoveContainerRequestDto(basement.Id)));

        Assert.Contains("Cannot move an archived container.", ex.Message);

        // Verify StorageNodeId remains unchanged
        var unchanged = await containerService.GetContainerAsync(identity, workspace.Id, container.Id);
        Assert.Equal(garage.Id, unchanged.StorageNodeId);
    }

    [Fact]
    public async Task MoveContainer_CrossWorkspaceAndNonMember_IsRejected()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var moveService = scope.ServiceProvider.GetRequiredService<IContainerMoveService>();

        var identityA = new AuthenticatedIdentity($"user_a_bm_{Guid.NewGuid():N}", "usera@bm.com", true);
        var identityB = new AuthenticatedIdentity($"user_b_bm_{Guid.NewGuid():N}", "userb@bm.com", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(identityA, new CreateWorkspaceRequestDto("WS A"));
        var wsB = await workspaceService.CreateWorkspaceAsync(identityB, new CreateWorkspaceRequestDto("WS B"));

        var nodeA = await locationService.CreateLocationAsync(identityA, wsA.Id, new CreateStorageLocationRequestDto("Node A", null));
        var nodeB = await locationService.CreateLocationAsync(identityB, wsB.Id, new CreateStorageLocationRequestDto("Node B", null));

        var containerA = await containerService.CreateContainerAsync(identityA, wsA.Id, new CreateContainerRequestDto(nodeA.Id, "Box A", null));

        // Attempt move to destination in WS B
        await Assert.ThrowsAsync<ArgumentException>(() =>
            moveService.MoveContainerAsync(identityA, wsA.Id, containerA.Id, new MoveContainerRequestDto(nodeB.Id)));

        // Non-member move attempt rejected
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            moveService.MoveContainerAsync(identityB, wsA.Id, containerA.Id, new MoveContainerRequestDto(nodeA.Id)));
    }
}
