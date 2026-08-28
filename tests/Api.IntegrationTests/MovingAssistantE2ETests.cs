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
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class MovingAssistantE2ETests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public MovingAssistantE2ETests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task MovingAssistant_FullVerticalSlice_QA_Test()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var moveService = scope.ServiceProvider.GetRequiredService<IContainerMoveService>();
        var transferService = scope.ServiceProvider.GetRequiredService<IContainerTransferService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();

        // Setup Test Identity
        var identity = new AuthenticatedIdentity(
            $"e2e_qa_uid_{Guid.NewGuid():N}",
            "e2e_qa_test_user@example.com",
            true
        );

        // =========================================================================
        // SETUP: Workspaces & Locations
        // =========================================================================
        
        // 1. Create Storage Space A: Apartment (automatically creates new Inventory Namespace)
        var wsA = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Apartment"));
        var dbWsA = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == wsA.Id);
        var nsId = dbWsA.InventoryNamespaceId;
        Assert.NotEqual(Guid.Empty, nsId);

        // 2. Create Storage Space B: New House (shares the same Inventory Namespace)
        var wsB = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("New House", nsId));
        var dbWsB = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == wsB.Id);
        Assert.Equal(nsId, dbWsB.InventoryNamespaceId);

        // 3. Create Storage Locations in Apartment
        var bedroom = await locationService.CreateLocationAsync(identity, wsA.Id, new CreateStorageLocationRequestDto("Bedroom", null));
        var livingRoom = await locationService.CreateLocationAsync(identity, wsA.Id, new CreateStorageLocationRequestDto("Living Room", null));

        // 4. Create Storage Locations in New House
        var garage = await locationService.CreateLocationAsync(identity, wsB.Id, new CreateStorageLocationRequestDto("Garage", null));
        var kitchen = await locationService.CreateLocationAsync(identity, wsB.Id, new CreateStorageLocationRequestDto("Kitchen", null));

        // =========================================================================
        // Phase 1 — PACK
        // =========================================================================
        
        // Create BOX 001
        var box1 = await containerService.CreateContainerAsync(identity, wsA.Id, new CreateContainerRequestDto(
            StorageNodeId: bedroom.Id,
            Name: "Books",
            Description: "Novels and text books",
            DestinationStorageNodeId: null,
            IsPacked: true,
            MovingPriority: "HIGH",
            PhysicalLabel: "Blue Box 1"
        ));

        // Create BOX 002
        var box2 = await containerService.CreateContainerAsync(identity, wsA.Id, new CreateContainerRequestDto(
            StorageNodeId: livingRoom.Id,
            Name: "Kitchenware",
            Description: "Fragile dining items",
            DestinationStorageNodeId: null,
            IsPacked: true,
            MovingPriority: "MEDIUM",
            PhysicalLabel: "Green Box 2"
        ));

        // Create Items inside BOX 002
        var itemPlates = await itemService.CreateItemAsync(identity, wsA.Id, box2.Id, new CreateItemRequestDto("Plates", 2, "Kitchen"));
        var itemCups = await itemService.CreateItemAsync(identity, wsA.Id, box2.Id, new CreateItemRequestDto("Cups", 6, "Kitchen"));

        // Attach Identifier/QR to BOX 002
        var qrToken = await identifierService.CreateIdentifierAsync(identity, wsA.Id, box2.Id, "QR");
        Assert.StartsWith("wzi_qr_", qrToken.Value);

        // Attach ImageAsset and InventoryCapture to BOX 002
        var imageAsset = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsA.Id,
            ContainerId = box2.Id,
            ObjectPath = "uploads/box2_label.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 1024,
            Status = "READY",
            ImagePurpose = "REFERENCE",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.ImageAssets.Add(imageAsset);

        var capture = new InventoryCapture
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsA.Id,
            ContainerId = box2.Id,
            ImageAssetId = imageAsset.Id,
            Status = "UPLOADED",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.InventoryCaptures.Add(capture);
        await db.SaveChangesAsync();

        // Capture Baseline Identity
        var baselineBox1 = await db.Containers.AsNoTracking().FirstAsync(c => c.Id == box1.Id);
        var baselineBox2 = await db.Containers.AsNoTracking().FirstAsync(c => c.Id == box2.Id);

        var platesId = itemPlates.Id;
        var cupsId = itemCups.Id;
        var qrId = qrToken.Id;
        var imageAssetId = imageAsset.Id;
        var captureId = capture.Id;

        // Perform Pack Assertions
        Assert.True(baselineBox1.IsPacked, "BOX 001 should be marked packed");
        Assert.True(baselineBox2.IsPacked, "BOX 002 should be marked packed");
        Assert.Equal("HIGH", baselineBox1.MovingPriority);
        Assert.Equal("MEDIUM", baselineBox2.MovingPriority);
        Assert.Equal(wsA.Id, baselineBox1.WorkspaceId);
        Assert.Equal(wsA.Id, baselineBox2.WorkspaceId);
        Assert.Equal(nsId, baselineBox1.InventoryNamespaceId);
        Assert.Equal(nsId, baselineBox2.InventoryNamespaceId);

        var itemsBox2 = await db.Items.AsNoTracking().Where(i => i.ContainerId == box2.Id).ToListAsync();
        Assert.Equal(2, itemsBox2.Count);
        Assert.Contains(itemsBox2, i => i.Name == "Plates" && i.Quantity == 2);
        Assert.Contains(itemsBox2, i => i.Name == "Cups" && i.Quantity == 6);
        Assert.NotEqual(baselineBox1.BoxNumber, baselineBox2.BoxNumber);

        // Fetch counter baseline before transfer
        var counterBefore = await db.InventoryNamespaceBoxCounters.AsNoTracking().FirstAsync(c => c.InventoryNamespaceId == nsId);
        var baselineNextBoxNumber = counterBefore.NextBoxNumber;

        // =========================================================================
        // Phase 2 — SAME-WORKSPACE MOVE
        // =========================================================================
        
        // Move BOX 001: Bedroom -> Living Room
        var movedBox1 = await moveService.MoveContainerAsync(identity, wsA.Id, box1.Id, new MoveContainerRequestDto(livingRoom.Id));

        // Refetch box1 from DB to assert
        var dbBox1Moved = await db.Containers.AsNoTracking().FirstAsync(c => c.Id == box1.Id);

        Assert.Equal(baselineBox1.Id, dbBox1Moved.Id);
        Assert.Equal(baselineBox1.BoxNumber, dbBox1Moved.BoxNumber);
        Assert.Equal(baselineBox1.InventoryNamespaceId, dbBox1Moved.InventoryNamespaceId);
        Assert.Equal(baselineBox1.WorkspaceId, dbBox1Moved.WorkspaceId); // Must remain in Apartment (wsA)
        Assert.Equal(livingRoom.Id, dbBox1Moved.StorageNodeId); // Location must change to Living Room
        Assert.True(dbBox1Moved.IsPacked, "BOX 001 must remain packed after move");
        Assert.Equal("HIGH", dbBox1Moved.MovingPriority);

        // Verify ActivityHistory log
        var historyMove = await db.ActivityHistories.AsNoTracking().AnyAsync(h => 
            h.WorkspaceId == wsA.Id && 
            h.ContainerId == box1.Id && 
            h.ActivityType == "CONTAINER_MOVED" && 
            h.PreviousStorageNodeId == bedroom.Id && 
            h.DestinationStorageNodeId == livingRoom.Id
        );
        Assert.True(historyMove, "A CONTAINER_MOVED ActivityHistory record should be created for same-workspace move.");

        // =========================================================================
        // Phase 3 — CROSS-WORKSPACE TRANSFER
        // =========================================================================
        
        // Transfer BOX 001 and BOX 002 from Apartment (wsA) to New House (wsB) -> Garage
        var transfer1 = await transferService.TransferContainerAsync(identity, nsId, box1.Id, new TransferContainerRequestDto(wsB.Id, garage.Id));
        var transfer2 = await transferService.TransferContainerAsync(identity, nsId, box2.Id, new TransferContainerRequestDto(wsB.Id, garage.Id));

        Assert.NotNull(transfer1);
        Assert.NotNull(transfer2);

        // Refetch from database
        var dbBox1Transferred = await db.Containers.AsNoTracking().FirstAsync(c => c.Id == box1.Id);
        var dbBox2Transferred = await db.Containers.AsNoTracking().FirstAsync(c => c.Id == box2.Id);

        // Stable identity check
        Assert.Equal(baselineBox1.Id, dbBox1Transferred.Id);
        Assert.Equal(baselineBox1.BoxNumber, dbBox1Transferred.BoxNumber);
        Assert.Equal(baselineBox1.InventoryNamespaceId, dbBox1Transferred.InventoryNamespaceId);

        Assert.Equal(baselineBox2.Id, dbBox2Transferred.Id);
        Assert.Equal(baselineBox2.BoxNumber, dbBox2Transferred.BoxNumber);
        Assert.Equal(baselineBox2.InventoryNamespaceId, dbBox2Transferred.InventoryNamespaceId);

        // Ownership change check
        Assert.Equal(wsB.Id, dbBox1Transferred.WorkspaceId);
        Assert.Equal(garage.Id, dbBox1Transferred.StorageNodeId);
        Assert.Equal(wsB.Id, dbBox2Transferred.WorkspaceId);
        Assert.Equal(garage.Id, dbBox2Transferred.StorageNodeId);

        // Lifecycle state intact check
        Assert.True(dbBox1Transferred.IsPacked);
        Assert.True(dbBox2Transferred.IsPacked);
        Assert.Equal("HIGH", dbBox1Transferred.MovingPriority);
        Assert.Equal("MEDIUM", dbBox2Transferred.MovingPriority);

        // Uniqueness check: exactly 1 row per Container ID in the DB
        var totalBox1InDb = await db.Containers.CountAsync(c => c.Id == box1.Id);
        var totalBox2InDb = await db.Containers.CountAsync(c => c.Id == box2.Id);
        Assert.Equal(1, totalBox1InDb);
        Assert.Equal(1, totalBox2InDb);

        // ----------------------------------------------------
        // Child-record integrity check
        // ----------------------------------------------------
        
        // Items
        var dbItemsAfter = await db.Items.AsNoTracking().Where(i => i.ContainerId == box2.Id).ToListAsync();
        Assert.Equal(2, dbItemsAfter.Count);
        Assert.Contains(dbItemsAfter, i => i.Id == platesId && i.Name == "Plates" && i.Quantity == 2 && i.WorkspaceId == wsB.Id);
        Assert.Contains(dbItemsAfter, i => i.Id == cupsId && i.Name == "Cups" && i.Quantity == 6 && i.WorkspaceId == wsB.Id);

        // Identifier/QR
        var dbQrAfter = await db.Identifiers.AsNoTracking().FirstOrDefaultAsync(i => i.Id == qrId);
        Assert.NotNull(dbQrAfter);
        Assert.Equal(box2.Id, dbQrAfter.ContainerId);
        Assert.Equal(wsB.Id, dbQrAfter.WorkspaceId); // Workspace updated correctly
        Assert.Equal(qrToken.Value, dbQrAfter.Value);

        // ImageAsset
        var dbImageAssetAfter = await db.ImageAssets.AsNoTracking().FirstOrDefaultAsync(i => i.Id == imageAssetId);
        Assert.NotNull(dbImageAssetAfter);
        Assert.Equal(box2.Id, dbImageAssetAfter.ContainerId);
        Assert.Equal(wsB.Id, dbImageAssetAfter.WorkspaceId); // Workspace updated correctly

        // InventoryCapture
        var dbCaptureAfter = await db.InventoryCaptures.AsNoTracking().FirstOrDefaultAsync(i => i.Id == captureId);
        Assert.NotNull(dbCaptureAfter);
        Assert.Equal(box2.Id, dbCaptureAfter.ContainerId);
        Assert.Equal(wsB.Id, dbCaptureAfter.WorkspaceId); // Workspace updated correctly

        // ----------------------------------------------------
        // Transfer history check
        // ----------------------------------------------------
        var historyOut = await db.ActivityHistories.AsNoTracking()
            .FirstOrDefaultAsync(h => h.WorkspaceId == wsA.Id && h.ActivityType == "TRANSFERRED_OUT" && h.ContainerId == box2.Id);
        Assert.NotNull(historyOut);
        Assert.Equal(livingRoom.Id, historyOut.PreviousStorageNodeId);

        var historyIn = await db.ActivityHistories.AsNoTracking()
            .FirstOrDefaultAsync(h => h.WorkspaceId == wsB.Id && h.ActivityType == "TRANSFERRED_IN" && h.ContainerId == box2.Id);
        Assert.NotNull(historyIn);
        Assert.Equal(garage.Id, historyIn.DestinationStorageNodeId);

        // ----------------------------------------------------
        // Namespace Integrity check
        // ----------------------------------------------------
        var counterAfter = await db.InventoryNamespaceBoxCounters.AsNoTracking().FirstAsync(c => c.InventoryNamespaceId == nsId);
        Assert.Equal(baselineNextBoxNumber, counterAfter.NextBoxNumber); // BoxNumbers not consumed during transfer

        // =========================================================================
        // Phase 4 — UNPACK
        // =========================================================================
        
        // Unpack BOX 001 and BOX 002 at New House (wsB)
        var unpacked1 = await containerService.UnpackContainerAsync(identity, wsB.Id, box1.Id);
        var unpacked2 = await containerService.UnpackContainerAsync(identity, wsB.Id, box2.Id);

        Assert.NotNull(unpacked1);
        Assert.NotNull(unpacked2);

        // Refetch from database
        var dbBox1Unpacked = await db.Containers.AsNoTracking().FirstAsync(c => c.Id == box1.Id);
        var dbBox2Unpacked = await db.Containers.AsNoTracking().FirstAsync(c => c.Id == box2.Id);

        // Flag checks
        Assert.False(dbBox1Unpacked.IsPacked, "BOX 001 should be marked unpacked");
        Assert.Null(dbBox1Unpacked.MovingPriority);
        Assert.Null(dbBox1Unpacked.DestinationStorageNodeId);

        Assert.False(dbBox2Unpacked.IsPacked, "BOX 002 should be marked unpacked");
        Assert.Null(dbBox2Unpacked.MovingPriority);
        Assert.Null(dbBox2Unpacked.DestinationStorageNodeId);

        // Stable identity checks
        Assert.Equal(baselineBox1.Id, dbBox1Unpacked.Id);
        Assert.Equal(baselineBox1.BoxNumber, dbBox1Unpacked.BoxNumber);
        Assert.Equal(baselineBox1.InventoryNamespaceId, dbBox1Unpacked.InventoryNamespaceId);
        Assert.Equal(wsB.Id, dbBox1Unpacked.WorkspaceId);
        Assert.Equal(garage.Id, dbBox1Unpacked.StorageNodeId);

        Assert.Equal(baselineBox2.Id, dbBox2Unpacked.Id);
        Assert.Equal(baselineBox2.BoxNumber, dbBox2Unpacked.BoxNumber);
        Assert.Equal(baselineBox2.InventoryNamespaceId, dbBox2Unpacked.InventoryNamespaceId);
        Assert.Equal(wsB.Id, dbBox2Unpacked.WorkspaceId);
        Assert.Equal(garage.Id, dbBox2Unpacked.StorageNodeId);

        // Verify items remained intact under BOX 002
        var dbItemsFinal = await db.Items.AsNoTracking().Where(i => i.ContainerId == box2.Id).ToListAsync();
        Assert.Equal(2, dbItemsFinal.Count);
        Assert.Contains(dbItemsFinal, i => i.Id == platesId && i.Name == "Plates" && i.Quantity == 2);
        Assert.Contains(dbItemsFinal, i => i.Id == cupsId && i.Name == "Cups" && i.Quantity == 6);

        // =========================================================================
        // IDEMPOTENCY CHECK
        // =========================================================================
        
        // Unpack BOX 002 a second time (should remain unpacked safely)
        var unpacked2Again = await containerService.UnpackContainerAsync(identity, wsB.Id, box2.Id);
        Assert.False(unpacked2Again.IsPacked);
        Assert.Null(unpacked2Again.MovingPriority);

        // Verify items still intact
        var dbItemsFinalAgain = await db.Items.AsNoTracking().Where(i => i.ContainerId == box2.Id).ToListAsync();
        Assert.Equal(2, dbItemsFinalAgain.Count);

        // =========================================================================
        // FINAL DATABASE INTEGRITY CHECKS
        // =========================================================================
        
        var allContainers = await db.Containers.AsNoTracking().Where(c => c.InventoryNamespaceId == nsId).ToListAsync();
        Assert.Equal(2, allContainers.Count); // Exactly the original two containers exist
        Assert.Contains(allContainers, c => c.Id == box1.Id && c.BoxNumber == baselineBox1.BoxNumber);
        Assert.Contains(allContainers, c => c.Id == box2.Id && c.BoxNumber == baselineBox2.BoxNumber);

        // Verify both now share workspace B (New House) and node (Garage)
        Assert.All(allContainers, c =>
        {
            Assert.Equal(wsB.Id, c.WorkspaceId);
            Assert.Equal(garage.Id, c.StorageNodeId);
        });

        // Verify items final state
        var finalItems = await db.Items.AsNoTracking().Where(i => i.WorkspaceId == wsB.Id).ToListAsync();
        Assert.Equal(2, finalItems.Count);
        Assert.Contains(finalItems, i => i.Id == platesId && i.Name == "Plates" && i.Quantity == 2 && i.ContainerId == box2.Id);
        Assert.Contains(finalItems, i => i.Id == cupsId && i.Name == "Cups" && i.Quantity == 6 && i.ContainerId == box2.Id);
    }
}
