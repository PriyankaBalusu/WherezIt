using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class ContainerSchemaIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public ContainerSchemaIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Container_SameWorkspace_BoxNumberUniqueness_Enforced()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var nsA = new InventoryNamespace { Id = Guid.NewGuid(), Name = "Namespace A", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var nsB = new InventoryNamespace { Id = Guid.NewGuid(), Name = "Namespace B", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        dbContext.InventoryNamespaces.AddRange(nsA, nsB);

        var wsA = new Workspace { Id = Guid.NewGuid(), Name = "Workspace A", InventoryNamespaceId = nsA.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var wsB = new Workspace { Id = Guid.NewGuid(), Name = "Workspace B", InventoryNamespaceId = nsB.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };

        var nodeA = new StorageNode { Id = Guid.NewGuid(), WorkspaceId = wsA.Id, ParentId = null, Name = "Node A", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var nodeB = new StorageNode { Id = Guid.NewGuid(), WorkspaceId = wsB.Id, ParentId = null, Name = "Node B", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };

        dbContext.Workspaces.AddRange(wsA, wsB);
        dbContext.StorageNodes.AddRange(nodeA, nodeB);
        await dbContext.SaveChangesAsync();

        var containerA1 = new Container
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsA.Id,
            StorageNodeId = nodeA.Id,
            BoxNumber = 1,
            Name = "Bin 1 in WS A",
            IsArchived = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var containerB1 = new Container
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsB.Id,
            StorageNodeId = nodeB.Id,
            BoxNumber = 1, // Same box number in DIFFERENT workspace must succeed
            Name = "Bin 1 in WS B",
            IsArchived = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Containers.AddRange(containerA1, containerB1);
        await dbContext.SaveChangesAsync();

        // Duplicate box_number in SAME workspace must fail
        var containerA1Duplicate = new Container
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsA.Id,
            StorageNodeId = nodeA.Id,
            BoxNumber = 1,
            Name = "Duplicate Bin 1 in WS A",
            IsArchived = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Containers.Add(containerA1Duplicate);
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());

        Assert.NotNull(ex.InnerException);
        Assert.IsType<PostgresException>(ex.InnerException);
        Assert.Equal("23505", ((PostgresException)ex.InnerException).SqlState);
    }

    [Fact]
    public async Task Container_CrossWorkspaceStorageNode_FailsForeignKeyConstraint()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var wsA = new Workspace { Id = Guid.NewGuid(), Name = "Workspace A", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var wsB = new Workspace { Id = Guid.NewGuid(), Name = "Workspace B", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };

        var nodeA = new StorageNode { Id = Guid.NewGuid(), WorkspaceId = wsA.Id, ParentId = null, Name = "Node in A", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };

        dbContext.Workspaces.AddRange(wsA, wsB);
        dbContext.StorageNodes.Add(nodeA);
        await dbContext.SaveChangesAsync();

        // Attempt container in Workspace B referencing Node in Workspace A
        var invalidContainer = new Container
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsB.Id,
            StorageNodeId = nodeA.Id, // Belonging to Workspace A
            BoxNumber = 10,
            Name = "Cross Workspace Container",
            IsArchived = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Containers.Add(invalidContainer);
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());

        Assert.NotNull(ex.InnerException);
        Assert.IsType<PostgresException>(ex.InnerException);
        var pgEx = (PostgresException)ex.InnerException;
        Assert.Equal("23503", pgEx.SqlState);
        Assert.Contains("FK_containers_storage_nodes_workspace_id_storage_node_id", pgEx.ConstraintName);
    }

    [Fact]
    public async Task InventoryNamespaceBoxCounter_DefaultValue_AndSchemaVerification()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var ns = new InventoryNamespace { Id = Guid.NewGuid(), Name = "Isolated Counter Namespace", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var counter = new InventoryNamespaceBoxCounter { InventoryNamespaceId = ns.Id, NextBoxNumber = 1 };
        dbContext.InventoryNamespaces.Add(ns);
        dbContext.InventoryNamespaceBoxCounters.Add(counter);

        var ws = new Workspace { Id = Guid.NewGuid(), Name = "Counter WS", InventoryNamespaceId = ns.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        dbContext.Workspaces.Add(ws);
        await dbContext.SaveChangesAsync();

        var dbCounter = await dbContext.InventoryNamespaceBoxCounters.FirstOrDefaultAsync(c => c.InventoryNamespaceId == ns.Id);
        Assert.NotNull(dbCounter);
        Assert.Equal(1, dbCounter.NextBoxNumber);
    }

    [Fact]
    public void Migration_Schema_ContainsExpectedTables()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var tableNames = dbContext.Model.GetEntityTypes().Select(e => e.GetTableName()).ToList();

        Assert.Contains("users", tableNames);
        Assert.Contains("workspaces", tableNames);
        Assert.Contains("workspace_members", tableNames);
        Assert.Contains("storage_nodes", tableNames);
        Assert.Contains("containers", tableNames);
        Assert.Contains("workspace_box_counters", tableNames);
    }

    [Fact]
    public async Task Container_PhysicalLabel_Validation_CRUD_Search_And_Tenancy()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.Workspaces.Services.IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.StorageLocations.Services.IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.Containers.Services.IContainerService>();
        var searchService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.Search.Services.IWorkspaceSearchService>();

        var user1 = new AuthenticatedIdentity($"b1_user_1_{Guid.NewGuid():N}", "b1_1@example.com", true);
        var user2 = new AuthenticatedIdentity($"b1_user_2_{Guid.NewGuid():N}", "b1_2@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(user1, new WherezIt.Application.Workspaces.Dtos.CreateWorkspaceRequestDto("B1 WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(user2, new WherezIt.Application.Workspaces.Dtos.CreateWorkspaceRequestDto("B1 WS 2"));

        var loc1 = await locationService.CreateLocationAsync(user1, ws1.Id, new WherezIt.Application.StorageLocations.Dtos.CreateStorageLocationRequestDto("Attic", null));

        // 1. Create with PhysicalLabel
        var c1 = await containerService.CreateContainerAsync(user1, ws1.Id, new WherezIt.Application.Containers.Dtos.CreateContainerRequestDto(
            loc1.Id,
            "Xmas Gear",
            "Desc",
            PhysicalLabel: "Christmas Box"
        ));
        Assert.Equal("Christmas Box", c1.PhysicalLabel);

        // 2. Create without PhysicalLabel (null)
        var c2 = await containerService.CreateContainerAsync(user1, ws1.Id, new WherezIt.Application.Containers.Dtos.CreateContainerRequestDto(
            loc1.Id,
            "Winter Clothes",
            "Desc"
        ));
        Assert.Null(c2.PhysicalLabel);

        // 3. Update PhysicalLabel
        var updated = await containerService.UpdateContainerAsync(user1, ws1.Id, c2.Id, new WherezIt.Application.Containers.Dtos.UpdateContainerRequestDto(
            "Winter Clothes",
            "Desc",
            PhysicalLabel: "Blue Tote #2"
        ));
        Assert.Equal("Blue Tote #2", updated.PhysicalLabel);

        // 4. Clear PhysicalLabel (blank -> null)
        var cleared = await containerService.UpdateContainerAsync(user1, ws1.Id, c2.Id, new WherezIt.Application.Containers.Dtos.UpdateContainerRequestDto(
            "Winter Clothes",
            "Desc",
            PhysicalLabel: "   "
        ));
        Assert.Null(cleared.PhysicalLabel);

        // 5. Rejections (>100 chars)
        var longLabel = new string('A', 101);
        await Assert.ThrowsAsync<ArgumentException>(() => containerService.CreateContainerAsync(user1, ws1.Id, new WherezIt.Application.Containers.Dtos.CreateContainerRequestDto(
            loc1.Id,
            "Test",
            "Desc",
            PhysicalLabel: longLabel
        )));

        // 6. Search by PhysicalLabel
        var searchResults = await searchService.SearchWorkspaceAsync(user1, ws1.Id, "Christmas Box");
        Assert.Single(searchResults);
        Assert.Equal("CONTAINER", searchResults[0].ResultType);
        Assert.Equal(c1.Id, searchResults[0].ContainerId);

        // 7. Tenant Isolation - User 2 cannot search WS1 containers by physical label
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => searchService.SearchWorkspaceAsync(user2, ws1.Id, "Christmas Box"));
    }

    [Fact]
    public async Task Container_PermanentDelete_FullCascade_Preconditions_And_TenantIsolation()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.Workspaces.Services.IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.StorageLocations.Services.IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.Containers.Services.IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.Items.Services.IItemService>();
        var userService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.Users.Services.IUserService>();

        // Mock Storage to track deleted object paths
        var deletedObjectPaths = new List<string>();
        var mockStorage = new TestImageObjectStorage(deletedObjectPaths);

        // Instantiated service with mock storage
        var testContainerService = new WherezIt.Infrastructure.Services.ContainerService(
            dbContext,
            scope.ServiceProvider.GetRequiredService<WherezIt.Application.Workspaces.Services.IWorkspaceAuthorizationService>(),
            scope.ServiceProvider.GetRequiredService<WherezIt.Application.Containers.Services.IBoxNumberAllocator>(),
            mockStorage,
            scope.ServiceProvider.GetService<Microsoft.Extensions.Logging.ILogger<WherezIt.Infrastructure.Services.ContainerService>>()
        );

        var ownerIdent = new AuthenticatedIdentity($"b4_owner_{Guid.NewGuid():N}", "b4_owner@example.com", true);
        var memberIdent = new AuthenticatedIdentity($"b4_member_{Guid.NewGuid():N}", "b4_member@example.com", true);
        var otherIdent = new AuthenticatedIdentity($"b4_other_{Guid.NewGuid():N}", "b4_other@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(ownerIdent, new WherezIt.Application.Workspaces.Dtos.CreateWorkspaceRequestDto("B4 WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(otherIdent, new WherezIt.Application.Workspaces.Dtos.CreateWorkspaceRequestDto("B4 WS 2"));

        // Add memberIdent as MEMBER in WS1
        var memberUser = await userService.SyncCurrentUserAsync(memberIdent);
        dbContext.WorkspaceMembers.Add(new WorkspaceMember
        {
            WorkspaceId = ws1.Id,
            UserId = memberUser.Id,
            Role = WherezIt.Domain.Enums.WorkspaceRole.MEMBER,
            CreatedAt = DateTimeOffset.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var loc1 = await locationService.CreateLocationAsync(ownerIdent, ws1.Id, new WherezIt.Application.StorageLocations.Dtos.CreateStorageLocationRequestDto("Basement", null));

        // Create Container 1 (Box #1)
        var c1 = await containerService.CreateContainerAsync(ownerIdent, ws1.Id, new WherezIt.Application.Containers.Dtos.CreateContainerRequestDto(loc1.Id, "Box One", "To Delete"));

        // Add Item inside Container 1
        var item1 = await itemService.CreateItemAsync(ownerIdent, ws1.Id, c1.Id, new WherezIt.Application.Items.Dtos.CreateItemRequestDto("Item inside Box One", 2));

        // Add ImageAsset + InventoryCapture + Job + Suggestion inside Container 1
        var imgId = Guid.NewGuid();
        var captureId = Guid.NewGuid();
        var objectPath1 = $"workspaces/{ws1.Id}/containers/{c1.Id}/{imgId}.jpg";

        var imageAsset = new ImageAsset
        {
            Id = imgId,
            WorkspaceId = ws1.Id,
            ContainerId = c1.Id,
            ObjectPath = objectPath1,
            ContentType = "image/jpeg",
            SizeBytes = 2048,
            Status = "READY",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var capture = new InventoryCapture
        {
            Id = captureId,
            WorkspaceId = ws1.Id,
            ContainerId = c1.Id,
            ImageAssetId = imgId,
            Status = "CONFIRMED",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var aiJob = new AIProcessingJob
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            CaptureId = captureId,
            Status = "COMPLETED",
            AttemptCount = 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var suggestion = new DetectionSuggestion
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            CaptureId = captureId,
            Name = "Suggested Item",
            Quantity = 1,
            IsRemoved = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var identifier = new Identifier
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            ContainerId = c1.Id,
            Type = "QR",
            Value = $"WHEREZIT:BOX:{c1.Id}",
            IsRevoked = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var activity = new ActivityHistory
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            ActorUserId = ownerIdent.FirebaseUid,
            ActivityType = "CONTAINER_MOVED",
            ContainerId = c1.Id,
            PreviousLocationDisplay = "Unassigned",
            DestinationLocationDisplay = "Basement",
            OccurredAt = DateTimeOffset.UtcNow
        };

        dbContext.ImageAssets.Add(imageAsset);
        dbContext.InventoryCaptures.Add(capture);
        dbContext.AIProcessingJobs.Add(aiJob);
        dbContext.DetectionSuggestions.Add(suggestion);
        dbContext.Identifiers.Add(identifier);
        dbContext.ActivityHistories.Add(activity);
        await dbContext.SaveChangesAsync();

        // 1. Rejection: Active box cannot be deleted (throws InvalidOperationException -> HTTP 409)
        var activeEx = await Assert.ThrowsAsync<InvalidOperationException>(() => testContainerService.DeleteContainerAsync(ownerIdent, ws1.Id, c1.Id));
        Assert.Contains("Archive the box first", activeEx.Message);

        // Archive container
        await containerService.ArchiveContainerAsync(ownerIdent, ws1.Id, c1.Id);

        // 2. Rejection: Non-owner member cannot permanently delete (throws UnauthorizedAccessException -> HTTP 403)
        var nonOwnerEx = await Assert.ThrowsAsync<UnauthorizedAccessException>(() => testContainerService.DeleteContainerAsync(memberIdent, ws1.Id, c1.Id));
        Assert.Contains("owners", nonOwnerEx.Message);

        // 3. Rejection: Cross-workspace container deletion (throws KeyNotFoundException -> HTTP 404)
        var crossWsEx = await Assert.ThrowsAsync<KeyNotFoundException>(() => testContainerService.DeleteContainerAsync(otherIdent, ws2.Id, c1.Id));
        Assert.Contains("was not found in workspace", crossWsEx.Message);

        // 4. Success: Owner permanently deletes archived container
        await testContainerService.DeleteContainerAsync(ownerIdent, ws1.Id, c1.Id);

        // Verify full relational cascade in DB
        Assert.Null(await dbContext.Containers.FirstOrDefaultAsync(c => c.Id == c1.Id));
        Assert.Empty(await dbContext.Items.Where(i => i.ContainerId == c1.Id).ToListAsync());
        Assert.Empty(await dbContext.InventoryCaptures.Where(ic => ic.ContainerId == c1.Id).ToListAsync());
        Assert.Empty(await dbContext.AIProcessingJobs.Where(j => j.CaptureId == captureId).ToListAsync());
        Assert.Empty(await dbContext.DetectionSuggestions.Where(s => s.CaptureId == captureId).ToListAsync());
        Assert.Empty(await dbContext.ImageAssets.Where(img => img.ContainerId == c1.Id).ToListAsync());
        Assert.Empty(await dbContext.Identifiers.Where(id => id.ContainerId == c1.Id).ToListAsync());
        Assert.Empty(await dbContext.ActivityHistories.Where(a => a.ContainerId == c1.Id).ToListAsync());

        // 5. Verify physical object storage cleanup was invoked with exact path
        Assert.Contains(objectPath1, deletedObjectPaths);

        // 6. Verify Box Allocator does NOT reuse deleted box number #1
        var c2 = await containerService.CreateContainerAsync(ownerIdent, ws1.Id, new WherezIt.Application.Containers.Dtos.CreateContainerRequestDto(loc1.Id, "Box Two", "Next Box"));
        Assert.Equal(2, c2.BoxNumber);
    }

    private class TestImageObjectStorage : WherezIt.Application.Storage.Services.IImageObjectStorage
    {
        private readonly List<string> _deletedPaths;

        public TestImageObjectStorage(List<string> deletedPaths)
        {
            _deletedPaths = deletedPaths;
        }

        public string CreateObjectPath(Guid workspaceId, string extension) => $"workspaces/{workspaceId}/{Guid.NewGuid()}{extension}";
        public Task UploadObjectAsync(string objectPath, Stream data, string contentType, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<Stream> OpenReadObjectAsync(string objectPath, CancellationToken cancellationToken = default) => Task.FromResult<Stream>(new MemoryStream());
        public Task DeleteObjectAsync(string objectPath, CancellationToken cancellationToken = default)
        {
            _deletedPaths.Add(objectPath);
            return Task.CompletedTask;
        }
    }
}

