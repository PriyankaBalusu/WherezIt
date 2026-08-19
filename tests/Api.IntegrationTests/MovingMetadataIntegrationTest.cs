using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Identifiers.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class MovingMetadataIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public MovingMetadataIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task ContainerMovingMetadata_PersistsEnforcesValidationAndRestrictsCrossWorkspaceDestination()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();

        var userA = new AuthenticatedIdentity("user-mov-a", "usera@example.com", true);
        var userB = new AuthenticatedIdentity("user-mov-b", "userb@example.com", true);

        // 1. Create Workspace A & locations
        var wsA = await workspaceService.CreateWorkspaceAsync(userA, new CreateWorkspaceRequestDto("Workspace A"));
        var locCurrent = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Current Room", null));
        var locDestA = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Destination Room", null));

        // 2. Create Workspace B & destination
        var wsB = await workspaceService.CreateWorkspaceAsync(userB, new CreateWorkspaceRequestDto("Workspace B"));
        var locDestB = await locationService.CreateLocationAsync(userB, wsB.Id, new CreateStorageLocationRequestDto("Workspace B Destination", null));

        // 3. Create Container in Workspace A (default IsPacked = false)
        var container = await containerService.CreateContainerAsync(userA, wsA.Id, new CreateContainerRequestDto(locCurrent.Id, "Moving Box 1", "Fragile"));
        Assert.False(container.IsPacked);
        Assert.Null(container.DestinationStorageNodeId);
        Assert.Null(container.MovingPriority);

        var qrToken = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, container.Id, "QR");
        var barToken = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, container.Id, "BARCODE");

        // 4. Update moving metadata with valid priority and destination
        var updated = await containerService.UpdateContainerAsync(userA, wsA.Id, container.Id, new UpdateContainerRequestDto(
            Name: "Moving Box 1",
            Description: "Fragile items",
            DestinationStorageNodeId: locDestA.Id,
            IsPacked: true,
            MovingPriority: "HIGH"
        ));

        Assert.True(updated.IsPacked);
        Assert.Equal(locDestA.Id, updated.DestinationStorageNodeId);
        Assert.Equal("HIGH", updated.MovingPriority);

        // 5. Invariants check: Current location, BOX ID, QR and BARCODE tokens are UNCHANGED
        Assert.Equal(locCurrent.Id, updated.StorageNodeId);
        Assert.Equal(container.BoxNumber, updated.BoxNumber);

        var qrAfter = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, container.Id, "QR");
        var barAfter = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, container.Id, "BARCODE");
        Assert.Equal(qrToken.Value, qrAfter.Value);
        Assert.Equal(barToken.Value, barAfter.Value);

        // 6. Invalid priority rejection
        await Assert.ThrowsAsync<ArgumentException>(async () =>
        {
            await containerService.UpdateContainerAsync(userA, wsA.Id, container.Id, new UpdateContainerRequestDto(
                Name: "Moving Box 1",
                Description: "Fragile items",
                MovingPriority: "URGENT"
            ));
        });

        // 7. Cross-workspace destination node rejection
        await Assert.ThrowsAsync<ArgumentException>(async () =>
        {
            await containerService.UpdateContainerAsync(userA, wsA.Id, container.Id, new UpdateContainerRequestDto(
                Name: "Moving Box 1",
                Description: "Fragile items",
                DestinationStorageNodeId: locDestB.Id
            ));
        });

        // 8. Unauthorized user update rejection
        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
        {
            await containerService.UpdateContainerAsync(userB, wsA.Id, container.Id, new UpdateContainerRequestDto(
                Name: "Hijacked Box",
                Description: "Hacked"
            ));
        });
    }
}
