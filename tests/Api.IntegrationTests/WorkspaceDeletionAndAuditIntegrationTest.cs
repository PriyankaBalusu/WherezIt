using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Users.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class WorkspaceDeletionAndAuditIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public WorkspaceDeletionAndAuditIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task AllowedUserIds_MappedCorrectly_InDatabase()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var audit = new WorkspaceAudit
        {
            Id = Guid.NewGuid(),
            WorkspaceId = Guid.NewGuid(),
            WorkspaceName = "Migration Test Space",
            InventoryNamespaceId = Guid.NewGuid(),
            EventType = "LOCATION_CREATED",
            ActorUserId = Guid.NewGuid().ToString(),
            AllowedUserIds = "user-1,user-2",
            OccurredAt = DateTimeOffset.UtcNow
        };

        dbContext.WorkspaceAudits.Add(audit);
        await dbContext.SaveChangesAsync();

        var saved = await dbContext.WorkspaceAudits.FindAsync(audit.Id);
        Assert.NotNull(saved);
        Assert.Equal("user-1,user-2", saved.AllowedUserIds);
    }

    [Fact]
    public async Task WorkspaceBoxCounter_SchemaCorrected_DeleteDoesNotQueryNonExistentRelation()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var ownerUid = $"box_cnt_owner_{Guid.NewGuid():N}";
        var ownerIdentity = new AuthenticatedIdentity(ownerUid, "boxcntowner@example.com", true);

        // 1. Create workspace (allocates inventory namespace)
        var ws = await workspaceService.CreateWorkspaceAsync(ownerIdentity, new CreateWorkspaceRequestDto("Counter Test Space"));
        var nsId = ws.InventoryNamespaceId;

        // 2. Create location and boxes (allocates sequential box numbers using inventory_namespace_box_counters)
        var loc = await locationService.CreateLocationAsync(ownerIdentity, ws.Id, new CreateStorageLocationRequestDto("Storage Bay", null));
        var box1 = await containerService.CreateContainerAsync(ownerIdentity, ws.Id, new CreateContainerRequestDto(loc.Id, "Box A"));
        var box2 = await containerService.CreateContainerAsync(ownerIdentity, ws.Id, new CreateContainerRequestDto(loc.Id, "Box B"));

        Assert.NotNull(box1);
        Assert.NotNull(box2);

        // 3. Verify box counter exists in inventory_namespace_box_counters
        var nsCounter = await dbContext.InventoryNamespaceBoxCounters.FirstOrDefaultAsync(c => c.InventoryNamespaceId == nsId);
        Assert.NotNull(nsCounter);
        Assert.True(nsCounter.NextBoxNumber >= 3);

        // 4. Delete workspace succeeds past counter cleanup without querying non-existent workspace_box_counters relation
        await workspaceService.DeleteWorkspaceAsync(ownerIdentity, ws.Id);

        // Workspace deleted, inventory namespace and counter survive
        Assert.False(await dbContext.Workspaces.AnyAsync(w => w.Id == ws.Id));
        Assert.True(await dbContext.InventoryNamespaces.AnyAsync(n => n.Id == nsId));
    }

    [Fact]
    public async Task OwnerDeletesWorkspace_ContainingFullRelationalGraph_SucceedsAndAuditsSurvive()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var ownerUid = $"hard_del_owner_{Guid.NewGuid():N}";
        var nonOwnerUid = $"hard_del_member_{Guid.NewGuid():N}";
        var ownerIdentity = new AuthenticatedIdentity(ownerUid, "harddelowner@example.com", true);
        var nonOwnerIdentity = new AuthenticatedIdentity(nonOwnerUid, "harddelmember@example.com", true);

        var ownerUser = await userService.SyncCurrentUserAsync(ownerIdentity);
        var nonOwnerUser = await userService.SyncCurrentUserAsync(nonOwnerIdentity);

        // 1. Create Workspace
        var createdWs = await workspaceService.CreateWorkspaceAsync(ownerIdentity, new CreateWorkspaceRequestDto("Full Graph Space"));
        var nsId = createdWs.InventoryNamespaceId;

        // 2. Add root location, sub-location, box, item
        var rootLoc = await locationService.CreateLocationAsync(ownerIdentity, createdWs.Id, new CreateStorageLocationRequestDto("Main Attic", null));
        var subLoc = await locationService.CreateLocationAsync(ownerIdentity, createdWs.Id, new CreateStorageLocationRequestDto("North Corner", rootLoc.Id));

        var box = await containerService.CreateContainerAsync(ownerIdentity, createdWs.Id, new CreateContainerRequestDto(subLoc.Id, "Attic Box #1", "Winter Gear", "STICKER-01"));
        var item = await itemService.CreateItemAsync(ownerIdentity, createdWs.Id, box.Id, new CreateItemRequestDto("Skis", 2, "Sports"));

        // Add AI capture, suggestion, job, image asset, identifier
        var imageAsset = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = createdWs.Id,
            ContainerId = box.Id,
            GcsPath = "gs://bucket/test.jpg",
            FileName = "test.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 100,
            ImagePurpose = "REFERENCE",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        dbContext.ImageAssets.Add(imageAsset);

        var capture = new InventoryCapture
        {
            Id = Guid.NewGuid(),
            WorkspaceId = createdWs.Id,
            ContainerId = box.Id,
            ImageAssetId = imageAsset.Id,
            Status = "CONFIRMED",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        dbContext.InventoryCaptures.Add(capture);

        var suggestion = new DetectionSuggestion
        {
            Id = Guid.NewGuid(),
            WorkspaceId = createdWs.Id,
            CaptureId = capture.Id,
            Name = "Poles",
            Quantity = 2,
            Confidence = 0.95m,
            IsRemoved = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        dbContext.DetectionSuggestions.Add(suggestion);

        var job = new AIProcessingJob
        {
            Id = Guid.NewGuid(),
            WorkspaceId = createdWs.Id,
            CaptureId = capture.Id,
            Status = "COMPLETED",
            AttemptCount = 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        dbContext.AIProcessingJobs.Add(job);

        await dbContext.SaveChangesAsync();

        // 8. Non-owner delete rejected
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            workspaceService.DeleteWorkspaceAsync(nonOwnerIdentity, createdWs.Id));

        // Workspace and data remain intact
        Assert.True(await dbContext.Workspaces.AnyAsync(w => w.Id == createdWs.Id));

        // 1 & 2. Owner hard delete succeeds
        await workspaceService.DeleteWorkspaceAsync(ownerIdentity, createdWs.Id);

        // 3. Workspace record and relational graph deleted
        Assert.False(await dbContext.Workspaces.AnyAsync(w => w.Id == createdWs.Id));
        Assert.False(await dbContext.StorageNodes.AnyAsync(n => n.WorkspaceId == createdWs.Id));
        Assert.False(await dbContext.Containers.AnyAsync(c => c.WorkspaceId == createdWs.Id));
        Assert.False(await dbContext.Items.AnyAsync(i => i.WorkspaceId == createdWs.Id));
        Assert.False(await dbContext.InventoryCaptures.AnyAsync(c => c.WorkspaceId == createdWs.Id));
        Assert.False(await dbContext.Set<DetectionSuggestion>().AnyAsync(s => s.WorkspaceId == createdWs.Id));
        Assert.False(await dbContext.Set<AIProcessingJob>().AnyAsync(j => j.WorkspaceId == createdWs.Id));

        // 4 & 5. Durable WorkspaceAudit WORKSPACE_DELETED survives with AllowedUserIds and InventoryNamespace intact
        var deletedAudits = await dbContext.WorkspaceAudits
            .Where(a => a.WorkspaceId == createdWs.Id && a.EventType == "WORKSPACE_DELETED")
            .ToListAsync();

        Assert.Single(deletedAudits);
        Assert.Contains(ownerUser.Id.ToString(), deletedAudits[0].AllowedUserIds);
        Assert.True(await dbContext.InventoryNamespaces.AnyAsync(n => n.Id == nsId));
    }
}
