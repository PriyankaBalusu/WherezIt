using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Identifiers.Services;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;
using WherezIt.Application.Search.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class TenantSecurityIntegrationTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public TenantSecurityIntegrationTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task TenantSecurityMatrix_EnforcesStrictWorkspaceIsolationAcrossAllSurfaces()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();

        // Actors
        var userA = new AuthenticatedIdentity("sec-user-a", "usera@tenant.test", true);
        var userB = new AuthenticatedIdentity("sec-user-b", "userb@tenant.test", true);

        // Setup Workspace A
        var wsA = await workspaceService.CreateWorkspaceAsync(userA, new CreateWorkspaceRequestDto("Tenant A Workspace"));
        var locA = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Shared Garage", null));
        var containerA = await containerService.CreateContainerAsync(userA, wsA.Id, new CreateContainerRequestDto(locA.Id, "Collision Box", "Box A"));
        var itemA = await itemService.CreateItemAsync(userA, wsA.Id, containerA.Id, new CreateItemRequestDto("Collision Drill", 1));
        var qrA = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, containerA.Id, "QR");
        var barA = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, containerA.Id, "BARCODE");

        // Setup Workspace B with Name/Box Collisions
        var wsB = await workspaceService.CreateWorkspaceAsync(userB, new CreateWorkspaceRequestDto("Tenant B Workspace"));
        var locB = await locationService.CreateLocationAsync(userB, wsB.Id, new CreateStorageLocationRequestDto("Shared Garage", null));
        var containerB = await containerService.CreateContainerAsync(userB, wsB.Id, new CreateContainerRequestDto(locB.Id, "Collision Box", "Box B"));
        var itemB = await itemService.CreateItemAsync(userB, wsB.Id, containerB.Id, new CreateItemRequestDto("Collision Drill", 1));
        var qrB = await identifierService.GetOrCreateIdentifierAsync(userB, wsB.Id, containerB.Id, "QR");
        var barB = await identifierService.GetOrCreateIdentifierAsync(userB, wsB.Id, containerB.Id, "BARCODE");

        // ----------------------------------------------------
        // 1. WORKSPACE ISOLATION
        // ----------------------------------------------------
        var userAWorkspaces = await workspaceService.GetUserWorkspacesAsync(userA);
        Assert.Contains(userAWorkspaces, w => w.Id == wsA.Id);
        Assert.DoesNotContain(userAWorkspaces, w => w.Id == wsB.Id);

        // ----------------------------------------------------
        // 2. LOCATION ISOLATION
        // ----------------------------------------------------
        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
            await locationService.GetLocationAsync(userA, wsB.Id, locB.Id));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
            await locationService.CreateLocationAsync(userA, wsB.Id, new CreateStorageLocationRequestDto("Hacked Location", null)));

        // ----------------------------------------------------
        // 3. CONTAINER ISOLATION
        // ----------------------------------------------------
        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
            await containerService.GetContainerAsync(userA, wsB.Id, containerB.Id));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
            await containerService.UpdateContainerAsync(userA, wsB.Id, containerB.Id, new UpdateContainerRequestDto("Hijacked Box", null)));

        // ----------------------------------------------------
        // 4. ITEM ISOLATION
        // ----------------------------------------------------
        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
            await itemService.GetItemAsync(userA, wsB.Id, itemB.Id));

        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
            await itemService.UpdateItemAsync(userA, wsB.Id, itemB.Id, new UpdateItemRequestDto("Hacked Drill", 5)));

        // ----------------------------------------------------
        // 5. SEARCH WORKSPACE ISOLATION (Collision Tests)
        // ----------------------------------------------------
        var searchResultsUserA = await searchService.SearchWorkspaceAsync(userA, wsA.Id, "Collision");
        Assert.True(searchResultsUserA.Count > 0);
        Assert.All(searchResultsUserA, r => Assert.NotEqual(containerB.Id, r.ContainerId));

        // ----------------------------------------------------
        // 6. IDENTIFIER RESOLUTION ISOLATION (Token possession != authorization)
        // ----------------------------------------------------
        // User A scanning User B's QR token returns 404
        await Assert.ThrowsAsync<KeyNotFoundException>(async () =>
            await identifierService.ResolveAuthorizedContainerAsync(userA, qrB.Value));

        // User A scanning User B's Barcode token returns 404
        await Assert.ThrowsAsync<KeyNotFoundException>(async () =>
            await identifierService.ResolveAuthorizedContainerAsync(userA, barB.Value));

        // User A acquiring Barcode for Workspace B container fails
        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
            await identifierService.GetOrCreateIdentifierAsync(userA, wsB.Id, containerB.Id, "BARCODE"));

        // ----------------------------------------------------
        // 7. MOVING METADATA ISOLATION
        // ----------------------------------------------------
        await Assert.ThrowsAsync<ArgumentException>(async () =>
            await containerService.UpdateContainerAsync(userA, wsA.Id, containerA.Id, new UpdateContainerRequestDto(
                Name: "Container A",
                Description: null,
                DestinationStorageNodeId: locB.Id // Cross-workspace node
            )));

        // ----------------------------------------------------
        // 8. DB MUTATION VERIFICATION (0 side-effects for rejected calls)
        // ----------------------------------------------------
        var containerBInDb = await db.Containers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == containerB.Id);
        Assert.NotNull(containerBInDb);
        Assert.Equal("Collision Box", containerBInDb.Name);
        Assert.Equal(locB.Id, containerBInDb.StorageNodeId);

        var itemBInDb = await db.Items.AsNoTracking().FirstOrDefaultAsync(i => i.Id == itemB.Id);
        Assert.NotNull(itemBInDb);
        Assert.Equal("Collision Drill", itemBInDb.Name);
        Assert.Equal(1, itemBInDb.Quantity);
    }
}
