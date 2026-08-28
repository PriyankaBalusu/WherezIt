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

public class UnpackIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public UnpackIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task UnpackContainer_SucceedsClearsMovingMetadataAndPreservesData()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();

        var userA = new AuthenticatedIdentity("user-unp-a", "usera@example.com", true);
        var userB = new AuthenticatedIdentity("user-unp-b", "userb@example.com", true);

        // 1. Setup Workspace A, StorageNode, DestinationStorageNode
        var wsA = await workspaceService.CreateWorkspaceAsync(userA, new CreateWorkspaceRequestDto("Workspace A"));
        var locCurrent = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Current Location", null));
        var locDest = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Destination Location", null));

        // 2. Create Workspace B (unauthorized for User A)
        var wsB = await workspaceService.CreateWorkspaceAsync(userB, new CreateWorkspaceRequestDto("Workspace B"));

        // 3. Create Container with metadata, items, and identifiers in Workspace A
        var container = await containerService.CreateContainerAsync(userA, wsA.Id, new CreateContainerRequestDto(
            StorageNodeId: locCurrent.Id,
            Name: "Moving Kitchen Box",
            Description: "Fragile plates and cups",
            PhysicalLabel: "Blue Box #5"
        ));

        // Add QR identifier
        var qrToken = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, container.Id, "QR");

        // Update container to packed state with priority and destination node
        var packed = await containerService.UpdateContainerAsync(userA, wsA.Id, container.Id, new UpdateContainerRequestDto(
            Name: "Moving Kitchen Box",
            Description: "Fragile plates and cups",
            DestinationStorageNodeId: locDest.Id,
            IsPacked: true,
            MovingPriority: "HIGH",
            PhysicalLabel: "Blue Box #5"
        ));

        Assert.True(packed.IsPacked);
        Assert.Equal("HIGH", packed.MovingPriority);
        Assert.Equal(locDest.Id, packed.DestinationStorageNodeId);

        var dbContainerBefore = await db.Containers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == container.Id);
        var initialNamespaceId = dbContainerBefore!.InventoryNamespaceId;

        // 4. Perform unpack operation
        var unpacked = await containerService.UnpackContainerAsync(userA, wsA.Id, container.Id);

        // Assertions for clean metadata removal
        Assert.False(unpacked.IsPacked);
        Assert.Null(unpacked.MovingPriority);
        Assert.Null(unpacked.DestinationStorageNodeId);

        // Assertions for data preservation
        Assert.Equal("Moving Kitchen Box", unpacked.Name);
        Assert.Equal("Fragile plates and cups", unpacked.Description);
        Assert.Equal("Blue Box #5", unpacked.PhysicalLabel);
        Assert.Equal(wsA.Id, unpacked.WorkspaceId);
        Assert.Equal(locCurrent.Id, unpacked.StorageNodeId);
        Assert.Equal(container.BoxNumber, unpacked.BoxNumber);

        var dbContainerAfter = await db.Containers.AsNoTracking().FirstOrDefaultAsync(c => c.Id == container.Id);
        Assert.NotNull(dbContainerAfter);
        Assert.Equal(initialNamespaceId, dbContainerAfter.InventoryNamespaceId);

        // Verify identifier is unchanged
        var qrAfter = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, container.Id, "QR");
        Assert.Equal(qrToken.Value, qrAfter.Value);

        // 5. Verify Idempotency: unpack again is safe and returns the same state
        var unpackedAgain = await containerService.UnpackContainerAsync(userA, wsA.Id, container.Id);
        Assert.False(unpackedAgain.IsPacked);
        Assert.Null(unpackedAgain.MovingPriority);
        Assert.Null(unpackedAgain.DestinationStorageNodeId);

        // 6. Verify Authorization: User B cannot unpack container in Workspace A
        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
        {
            await containerService.UnpackContainerAsync(userB, wsA.Id, container.Id);
        });

        // 7. Verify Route Context: request against wrong workspace is rejected (NotFound or Unauthorized)
        await Assert.ThrowsAnyAsync<Exception>(async () =>
        {
            await containerService.UnpackContainerAsync(userA, wsB.Id, container.Id);
        });
    }
}
