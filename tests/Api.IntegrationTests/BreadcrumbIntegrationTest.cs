using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class BreadcrumbIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public BreadcrumbIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task GetBreadcrumb_RootAndNestedLocations_ResolvesCorrectPath()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var breadcrumbService = scope.ServiceProvider.GetRequiredService<IBreadcrumbService>();

        var identity = new AuthenticatedIdentity($"bread_uid_{Guid.NewGuid():N}", "bread@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("My Home"));

        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var rack = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Rack A", garage.Id));
        var shelf = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Shelf 2", rack.Id));

        // 1. Root location breadcrumb
        var rootBreadcrumb = await breadcrumbService.GetBreadcrumbAsync(identity, workspace.Id, garage.Id);
        Assert.Equal(workspace.Id, rootBreadcrumb.WorkspaceId);
        Assert.Equal("My Home", rootBreadcrumb.WorkspaceName);
        Assert.Single(rootBreadcrumb.Segments);
        Assert.Equal("Garage", rootBreadcrumb.Segments[0].Name);
        Assert.Equal("My Home → Garage", rootBreadcrumb.DisplayPath);

        // 2. Deep nested location breadcrumb
        var deepBreadcrumb = await breadcrumbService.GetBreadcrumbAsync(identity, workspace.Id, shelf.Id);
        Assert.Equal(3, deepBreadcrumb.Segments.Count);
        Assert.Equal("Garage", deepBreadcrumb.Segments[0].Name);
        Assert.Equal("Rack A", deepBreadcrumb.Segments[1].Name);
        Assert.Equal("Shelf 2", deepBreadcrumb.Segments[2].Name);
        Assert.Equal("My Home → Garage → Rack A → Shelf 2", deepBreadcrumb.DisplayPath);
    }

    [Fact]
    public async Task GetBreadcrumb_LocationMoved_ReflectsUpdatedPath()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var moveService = scope.ServiceProvider.GetRequiredService<ILocationMoveService>();
        var breadcrumbService = scope.ServiceProvider.GetRequiredService<IBreadcrumbService>();

        var identity = new AuthenticatedIdentity($"bread_move_{Guid.NewGuid():N}", "breadmove@example.com", true);
        var workspace = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Move Home"));

        var garage = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Garage", null));
        var basement = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Basement", null));
        var box = await locationService.CreateLocationAsync(identity, workspace.Id, new CreateStorageLocationRequestDto("Tote 1", garage.Id));

        // Move Tote 1 from Garage to Basement
        await moveService.MoveLocationAsync(identity, workspace.Id, box.Id, new MoveStorageLocationRequestDto(basement.Id));

        var updatedBreadcrumb = await breadcrumbService.GetBreadcrumbAsync(identity, workspace.Id, box.Id);
        Assert.Equal(2, updatedBreadcrumb.Segments.Count);
        Assert.Equal("Basement", updatedBreadcrumb.Segments[0].Name);
        Assert.Equal("Tote 1", updatedBreadcrumb.Segments[1].Name);
        Assert.Equal("Move Home → Basement → Tote 1", updatedBreadcrumb.DisplayPath);
    }

    [Fact]
    public async Task GetBreadcrumb_NonMemberAndCrossWorkspace_IsRejected()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var breadcrumbService = scope.ServiceProvider.GetRequiredService<IBreadcrumbService>();

        var identityA = new AuthenticatedIdentity($"bread_a_{Guid.NewGuid():N}", "usera@bread.com", true);
        var identityB = new AuthenticatedIdentity($"bread_b_{Guid.NewGuid():N}", "userb@bread.com", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(identityA, new CreateWorkspaceRequestDto("WS A"));
        var wsB = await workspaceService.CreateWorkspaceAsync(identityB, new CreateWorkspaceRequestDto("WS B"));

        var nodeA = await locationService.CreateLocationAsync(identityA, wsA.Id, new CreateStorageLocationRequestDto("Node A", null));

        // Non-member access rejected
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            breadcrumbService.GetBreadcrumbAsync(identityB, wsA.Id, nodeA.Id));

        // Cross-workspace location lookup rejected
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            breadcrumbService.GetBreadcrumbAsync(identityB, wsB.Id, nodeA.Id));
    }
}
