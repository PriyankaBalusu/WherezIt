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

public class ContainerCrudIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public ContainerCrudIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Container_CreateAndGetContainers_AllocatesSequentialBoxNumbers()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();

        var identity = new AuthenticatedIdentity($"cont_uid_{Guid.NewGuid():N}", "cont@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Container Workspace"));
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));

        // Create Container 1
        var c1 = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Holiday Decor", "Christmas items"));
        Assert.NotNull(c1);
        Assert.Equal(1, c1.BoxNumber);
        Assert.Equal("BOX 001", c1.BoxId);
        Assert.Equal("Holiday Decor", c1.Name);
        Assert.False(c1.IsArchived);

        // Create Container 2
        var c2 = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Camping Gear", "Tents and sleeping bags"));
        Assert.NotNull(c2);
        Assert.Equal(2, c2.BoxNumber);
        Assert.Equal("BOX 002", c2.BoxId);

        // List Containers
        var containers = await containerService.GetContainersAsync(identity, workspace.Id);
        Assert.Equal(2, containers.Count);
        Assert.Equal("BOX 001", containers[0].BoxId);
        Assert.Equal("BOX 002", containers[1].BoxId);
    }

    [Fact]
    public async Task Container_UpdateAndArchive_PreservesBoxNumberImmutability()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();

        var identity = new AuthenticatedIdentity($"cont_upd_{Guid.NewGuid():N}", "contupd@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Update Workspace"));
        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));

        var c1 = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Old Name", "Old Desc"));
        Assert.Equal("BOX 001", c1.BoxId);

        // Update Name and Description
        var updated = await containerService.UpdateContainerAsync(identity, workspace.Id, c1.Id, new UpdateContainerRequestDto("Renamed Box", "New Desc"));
        Assert.Equal("Renamed Box", updated.Name);
        Assert.Equal("New Desc", updated.Description);
        Assert.Equal(1, updated.BoxNumber);
        Assert.Equal("BOX 001", updated.BoxId);
        Assert.Equal(garage.Id, updated.StorageNodeId);

        // Archive Container
        var archived = await containerService.ArchiveContainerAsync(identity, workspace.Id, c1.Id);
        Assert.True(archived.IsArchived);
        Assert.Equal("BOX 001", archived.BoxId);

        // Default list excludes archived
        var defaultList = await containerService.GetContainersAsync(identity, workspace.Id, includeArchived: false);
        Assert.Empty(defaultList);

        // List with includeArchived includes archived
        var listWithArchived = await containerService.GetContainersAsync(identity, workspace.Id, includeArchived: true);
        Assert.Single(listWithArchived);

        // Restore Container
        var restored = await containerService.RestoreContainerAsync(identity, workspace.Id, c1.Id);
        Assert.False(restored.IsArchived);

        // Subsequent creation after archive allocates next number (BOX 002)
        var c2 = await containerService.CreateContainerAsync(identity, workspace.Id, new CreateContainerRequestDto(garage.Id, "Second Box", null));
        Assert.Equal(2, c2.BoxNumber);
        Assert.Equal("BOX 002", c2.BoxId);
    }

    [Fact]
    public async Task Container_CrossWorkspaceLocationAndNonMember_IsRejected()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();

        var identityA = new AuthenticatedIdentity($"user_a_cont_{Guid.NewGuid():N}", "usera@cont.com", true);
        var identityB = new AuthenticatedIdentity($"user_b_cont_{Guid.NewGuid():N}", "userb@cont.com", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(identityA, new CreateWorkspaceRequestDto("WS A"));
        var wsB = await workspaceService.CreateWorkspaceAsync(identityB, new CreateWorkspaceRequestDto("WS B"));

        var nodeA = await locationService.CreateLocationAsync(identityA, wsA.Id, new CreateStorageLocationRequestDto("Node A", null));
        var nodeB = await locationService.CreateLocationAsync(identityB, wsB.Id, new CreateStorageLocationRequestDto("Node B", null));

        // Attempt container in WS A with StorageNode in WS B
        await Assert.ThrowsAsync<ArgumentException>(() =>
            containerService.CreateContainerAsync(identityA, wsA.Id, new CreateContainerRequestDto(nodeB.Id, "Cross Container", null)));

        // Non-member access in WS A rejected
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            containerService.GetContainersAsync(identityB, wsA.Id));
    }
}
