using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.ActivityHistory.Services;
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

public class ActivityHistoryIntegrationTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public ActivityHistoryIntegrationTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task ContainerMove_CreatesImmutableActivityRecordAndPreservesSnapshotsAfterNodeChanges()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var moveService = scope.ServiceProvider.GetRequiredService<IContainerMoveService>();
        var historyService = scope.ServiceProvider.GetRequiredService<IActivityHistoryService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();

        var userA = new AuthenticatedIdentity("user-act-1", "usera@act.test", true);
        var userB = new AuthenticatedIdentity("user-act-2", "userb@act.test", true);

        // 1. Setup Workspace A, parent location, and two child locations
        var wsA = await workspaceService.CreateWorkspaceAsync(userA, new CreateWorkspaceRequestDto("Activity WS"));
        var parentLoc = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Main Garage", null));
        var shelf1 = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Shelf 1", parentLoc.Id));
        var shelf2 = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Shelf 2", parentLoc.Id));

        // Setup Workspace B for tenant boundary checks
        var wsB = await workspaceService.CreateWorkspaceAsync(userB, new CreateWorkspaceRequestDto("Workspace B"));
        var shelfB = await locationService.CreateLocationAsync(userB, wsB.Id, new CreateStorageLocationRequestDto("Workspace B Shelf", null));

        // 2. Create container on Shelf 1
        var container = await containerService.CreateContainerAsync(userA, wsA.Id, new CreateContainerRequestDto(shelf1.Id, "Tool Box", "Hand tools"));
        var qrToken = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, container.Id, "QR");
        var barToken = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, container.Id, "BARCODE");

        // Initial history should be empty
        var initialHistory = await historyService.GetContainerHistoryAsync(userA, wsA.Id, container.Id);
        Assert.Empty(initialHistory);

        // 3. Move container to Shelf 2
        var moved = await moveService.MoveContainerAsync(userA, wsA.Id, container.Id, new MoveContainerRequestDto(shelf2.Id));
        Assert.Equal(shelf2.Id, moved.StorageNodeId);

        // 4. Verify ActivityHistory record was created atomically
        var historyList = await historyService.GetContainerHistoryAsync(userA, wsA.Id, container.Id);
        Assert.Single(historyList);

        var rec1 = historyList[0];
        Assert.Equal("CONTAINER_MOVED", rec1.ActivityType);
        Assert.Equal(container.Id, rec1.ContainerId);
        Assert.Equal(shelf1.Id, rec1.PreviousStorageNodeId);
        Assert.Equal(shelf2.Id, rec1.DestinationStorageNodeId);
        Assert.Equal("Main Garage → Shelf 1", rec1.PreviousLocationDisplay);
        Assert.Equal("Main Garage → Shelf 2", rec1.DestinationLocationDisplay);
        Assert.Equal(userA.FirebaseUid, rec1.ActorUserId);

        // Verify identifiers & BoxId remain unchanged
        Assert.Equal(container.BoxNumber, moved.BoxNumber);
        var qrAfter = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, container.Id, "QR");
        var barAfter = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, container.Id, "BARCODE");
        Assert.Equal(qrToken.Value, qrAfter.Value);
        Assert.Equal(barToken.Value, barAfter.Value);

        // 5. Test no-op move creates NO history record
        await moveService.MoveContainerAsync(userA, wsA.Id, container.Id, new MoveContainerRequestDto(shelf2.Id));
        var historyAfterNoOp = await historyService.GetContainerHistoryAsync(userA, wsA.Id, container.Id);
        Assert.Single(historyAfterNoOp);

        // 6. Test failed move (cross-workspace destination) creates NO history record
        await Assert.ThrowsAsync<ArgumentException>(async () =>
            await moveService.MoveContainerAsync(userA, wsA.Id, container.Id, new MoveContainerRequestDto(shelfB.Id)));

        var historyAfterFailed = await historyService.GetContainerHistoryAsync(userA, wsA.Id, container.Id);
        Assert.Single(historyAfterFailed);

        // 7. Rename location: Historical snapshot MUST REMAIN UNCHANGED
        await locationService.RenameLocationAsync(userA, wsA.Id, shelf1.Id, new RenameStorageLocationRequestDto("Renamed Shelf 1"));

        var historyAfterRename = await historyService.GetContainerHistoryAsync(userA, wsA.Id, container.Id);
        Assert.Equal("Main Garage → Shelf 1", historyAfterRename[0].PreviousLocationDisplay);

        // 8. Delete location (Shelf 1 is empty now): PreviousStorageNodeId becomes null while display snapshot remains intact
        await locationService.DeleteLocationAsync(userA, wsA.Id, shelf1.Id);

        var historyAfterDelete = await historyService.GetContainerHistoryAsync(userA, wsA.Id, container.Id);
        Assert.Single(historyAfterDelete);
        Assert.Equal("Main Garage → Shelf 1", historyAfterDelete[0].PreviousLocationDisplay);

        // 9. Tenant isolation checks
        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
            await historyService.GetContainerHistoryAsync(userB, wsA.Id, container.Id));

        await Assert.ThrowsAsync<KeyNotFoundException>(async () =>
            await historyService.GetContainerHistoryAsync(userA, wsB.Id, container.Id));
    }
}
