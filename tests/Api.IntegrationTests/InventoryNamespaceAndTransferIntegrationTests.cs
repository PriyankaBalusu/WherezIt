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
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Domain.Enums;
using WherezIt.Infrastructure.Persistence;
using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace WherezIt.Api.IntegrationTests;

public class InventoryNamespaceAndTransferIntegrationTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public InventoryNamespaceAndTransferIntegrationTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task CreateWorkspace_DefaultNamespaceCreationAndReuseFlow()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = $"owner_uid_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(testUid, "ns_user@example.com", true);

        // 1. First workspace: should automatically create default Inventory
        var result1 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Storage Space A"));
        Assert.NotNull(result1);

        var ws1 = await dbContext.Workspaces.FindAsync(result1.Id);
        Assert.NotNull(ws1);
        Assert.NotEqual(Guid.Empty, ws1.InventoryNamespaceId);
        Assert.Equal(ws1.InventoryNamespaceId, result1.InventoryNamespaceId);

        // Verify Inventory exists and user is Owner member
        var ns = await dbContext.InventoryNamespaces
            .Include(n => n.Members)
            .FirstOrDefaultAsync(n => n.Id == ws1.InventoryNamespaceId);
        Assert.NotNull(ns);
        Assert.Equal("My Inventory", ns.Name);
        Assert.Single(ns.Members);
        Assert.Equal(Domain.Enums.WorkspaceRole.OWNER, ns.Members.First().Role);

        // 2. Second workspace (no inventory passed): should reuse existing namespace
        var result2 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Storage Space B"));
        var ws2 = await dbContext.Workspaces.FindAsync(result2.Id);
        Assert.NotNull(ws2);
        Assert.Equal(ws1.InventoryNamespaceId, ws2.InventoryNamespaceId);
        Assert.Equal(ws2.InventoryNamespaceId, result2.InventoryNamespaceId);

        // Verify list returns matching InventoryNamespaceId
        var list = await workspaceService.GetUserWorkspacesAsync(identity);
        var listedWs1 = list.FirstOrDefault(w => w.Id == result1.Id);
        Assert.NotNull(listedWs1);
        Assert.Equal(ws1.InventoryNamespaceId, listedWs1.InventoryNamespaceId);

        // Verify still only one namespace and counter exists
        var counter = await dbContext.InventoryNamespaceBoxCounters.FindAsync(ws1.InventoryNamespaceId);
        Assert.NotNull(counter);
    }

    [Fact]
    public async Task CreateWorkspace_MultiInventoryChoiceEnforcement()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = $"owner_uid_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(testUid, "multi_ns_user@example.com", true);

        // Create first namespace (Inventory 1) by creating Workspace A
        var wsA = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Workspace A"));
        var dbWsA = await dbContext.Workspaces.FindAsync(wsA.Id);

        // Manually create a second namespace (Inventory 2) and associate the user
        var now = DateTimeOffset.UtcNow;
        var secondNs = new InventoryNamespace
        {
            Id = Guid.NewGuid(),
            Name = "Second Inventory",
            CreatedAt = now,
            UpdatedAt = now
        };
        var secondMember = new InventoryNamespaceMember
        {
            InventoryNamespaceId = secondNs.Id,
            UserId = dbContext.WorkspaceMembers.First(m => m.WorkspaceId == dbWsA.Id).UserId,
            Role = WorkspaceRole.OWNER,
            CreatedAt = now
        };
        var secondCounter = new InventoryNamespaceBoxCounter
        {
            InventoryNamespaceId = secondNs.Id,
            NextBoxNumber = 1
        };

        dbContext.InventoryNamespaces.Add(secondNs);
        dbContext.InventoryNamespaceMembers.Add(secondMember);
        dbContext.InventoryNamespaceBoxCounters.Add(secondCounter);
        await dbContext.SaveChangesAsync();

        // 3. Creating workspace without specifying namespace should fail
        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Workspace C")));
        Assert.Contains("InventoryNamespaceId is required because you belong to multiple inventories", ex.Message);

        // 4. Creating workspace with valid second namespace should succeed
        var wsC = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Workspace C", secondNs.Id));
        var dbWsC = await dbContext.Workspaces.FindAsync(wsC.Id);
        Assert.NotNull(dbWsC);
        Assert.Equal(secondNs.Id, dbWsC.InventoryNamespaceId);
    }

    [Fact]
    public async Task TransferContainer_SucceedsAcrossWorkspacesInSameInventory()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var transferService = scope.ServiceProvider.GetRequiredService<IContainerTransferService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = $"owner_uid_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(testUid, "transfer_owner@example.com", true);

        // Create Workspace A and StorageNode A
        var wsA = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Workspace A"));
        var dbWsA = await dbContext.Workspaces.FindAsync(wsA.Id);
        var nsId = dbWsA.InventoryNamespaceId;

        var nodeA = await locationService.CreateLocationAsync(identity, wsA.Id, new CreateStorageLocationRequestDto("Node A", null));

        // Create Container in Workspace A
        var box = await containerService.CreateContainerAsync(identity, wsA.Id, new CreateContainerRequestDto(nodeA.Id, "BOX 001", null, null, false, null, null));

        // Add an item to Container
        var item = new Item
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsA.Id,
            ContainerId = box.Id,
            Name = "Item 1",
            Source = "MANUAL",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        dbContext.Items.Add(item);

        // Create Workspace B in the same inventory namespace
        var wsB = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Workspace B"));
        var nodeB = await locationService.CreateLocationAsync(identity, wsB.Id, new CreateStorageLocationRequestDto("Node B", null));
        await dbContext.SaveChangesAsync();

        // Perform Transfer
        var transferResult = await transferService.TransferContainerAsync(
            identity,
            nsId,
            box.Id,
            new TransferContainerRequestDto(wsB.Id, nodeB.Id));

        Assert.NotNull(transferResult);
        Assert.Equal(wsB.Id, transferResult.WorkspaceId);
        Assert.Equal(nodeB.Id, transferResult.StorageNodeId);

        // Verify item workspace was updated to B
        var dbItem = await dbContext.Items.AsNoTracking().FirstOrDefaultAsync(i => i.Id == item.Id);
        Assert.NotNull(dbItem);
        Assert.Equal(wsB.Id, dbItem.WorkspaceId);

        // Verify activity histories were written
        var historyOut = await dbContext.ActivityHistories
            .FirstOrDefaultAsync(h => h.WorkspaceId == wsA.Id && h.ActivityType == "TRANSFERRED_OUT" && h.ContainerId == box.Id);
        Assert.NotNull(historyOut);
        Assert.Contains("Workspace A", historyOut.PreviousLocationDisplay);
        Assert.Contains("Workspace B", historyOut.DestinationLocationDisplay);

        var historyIn = await dbContext.ActivityHistories
            .FirstOrDefaultAsync(h => h.WorkspaceId == wsB.Id && h.ActivityType == "TRANSFERRED_IN" && h.ContainerId == box.Id);
        Assert.NotNull(historyIn);
        Assert.Contains("Workspace A", historyIn.PreviousLocationDisplay);
        Assert.Contains("Workspace B", historyIn.DestinationLocationDisplay);
    }

    [Fact]
    public async Task TransferContainer_FailsIfDestinationWorkspaceIsSame()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var transferService = scope.ServiceProvider.GetRequiredService<IContainerTransferService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = $"owner_uid_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(testUid, "same_ws@example.com", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Workspace A"));
        var dbWsA = await dbContext.Workspaces.FindAsync(wsA.Id);
        var nsId = dbWsA.InventoryNamespaceId;

        var nodeA = await locationService.CreateLocationAsync(identity, wsA.Id, new CreateStorageLocationRequestDto("Node A", null));
        var box = await containerService.CreateContainerAsync(identity, wsA.Id, new CreateContainerRequestDto(nodeA.Id, "BOX 001", null, null, false, null, null));

        var ex = await Assert.ThrowsAsync<ArgumentException>(() =>
            transferService.TransferContainerAsync(
                identity,
                nsId,
                box.Id,
                new TransferContainerRequestDto(wsA.Id, nodeA.Id)));

        Assert.Contains("Destination workspace must be different from source workspace", ex.Message);
    }

    [Fact]
    public async Task CounterValidation_AllNamespacesHaveCorrectNextBoxNumber()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var namespaces = await dbContext.InventoryNamespaces
            .Include(n => n.BoxCounter)
            .ToListAsync();

        foreach (var ns in namespaces)
        {
            var maxBoxNumber = await dbContext.Containers
                .Where(c => c.InventoryNamespaceId == ns.Id)
                .MaxAsync(c => (int?)c.BoxNumber) ?? 0;

            Assert.NotNull(ns.BoxCounter);
            Assert.Equal(maxBoxNumber + 1, ns.BoxCounter.NextBoxNumber);
        }
    }

    [Fact]
    public async Task BoxCreationAfterMigration_AllocatesCorrectNextNumberAndDoesNotCollide()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = $"owner_uid_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(testUid, "box_creation_after_mig@example.com", true);

        // Create workspace - this will create a new namespace
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Workspace with Boxes"));
        var dbWs = await dbContext.Workspaces.FindAsync(ws.Id);
        var nsId = dbWs.InventoryNamespaceId;

        var node = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Location 1", null));

        // Create first container - should get BoxNumber 1
        var box1 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(node.Id, "BOX 1", null, null, false, null, null));
        Assert.Equal(1, box1.BoxNumber);

        // Verify NextBoxNumber in counter is now 2
        var counter = await dbContext.InventoryNamespaceBoxCounters.AsNoTracking().FirstOrDefaultAsync(c => c.InventoryNamespaceId == nsId);
        Assert.NotNull(counter);
        Assert.Equal(2, counter.NextBoxNumber);

        // Create second container - should get BoxNumber 2
        var box2 = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(node.Id, "BOX 2", null, null, false, null, null));
        Assert.Equal(2, box2.BoxNumber);

        // Verify counter is now 3
        counter = await dbContext.InventoryNamespaceBoxCounters.AsNoTracking().FirstOrDefaultAsync(c => c.InventoryNamespaceId == nsId);
        Assert.NotNull(counter);
        Assert.Equal(3, counter.NextBoxNumber);
    }

    [Fact]
    public async Task Migration_PlPgSqlGroupingAndCounterLogic_Verification()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        using var transaction = await db.Database.BeginTransactionAsync();
        try
        {
            await db.Database.ExecuteSqlRawAsync("ALTER TABLE containers DROP CONSTRAINT \"FK_containers_workspaces_inventory_namespace_id_workspace_id\";");
            await db.Database.ExecuteSqlRawAsync("SET CONSTRAINTS ALL DEFERRED;");

            var user1 = new User { Id = Guid.NewGuid(), FirebaseUid = $"u1_{Guid.NewGuid():N}", Email = "u1@test.com", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            var user2 = new User { Id = Guid.NewGuid(), FirebaseUid = $"u2_{Guid.NewGuid():N}", Email = "u2@test.com", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            var user3 = new User { Id = Guid.NewGuid(), FirebaseUid = $"u3_{Guid.NewGuid():N}", Email = "u3@test.com", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            db.Users.AddRange(user1, user2, user3);
            await db.SaveChangesAsync();

            var dummyNs = new InventoryNamespace { Id = Guid.NewGuid(), Name = "Dummy Ns", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            db.InventoryNamespaces.Add(dummyNs);
            await db.SaveChangesAsync();

            var wsZero1 = new Workspace { Id = Guid.NewGuid(), Name = "Zero Owner 1", InventoryNamespaceId = dummyNs.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            var wsZero2 = new Workspace { Id = Guid.NewGuid(), Name = "Zero Owner 2", InventoryNamespaceId = dummyNs.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            
            var wsSoleU1_A = new Workspace { Id = Guid.NewGuid(), Name = "Sole U1 A", InventoryNamespaceId = dummyNs.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            var wsSoleU1_B = new Workspace { Id = Guid.NewGuid(), Name = "Sole U1 B", InventoryNamespaceId = dummyNs.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            var wsSoleU2 = new Workspace { Id = Guid.NewGuid(), Name = "Sole U2", InventoryNamespaceId = dummyNs.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };

            var wsMulti12 = new Workspace { Id = Guid.NewGuid(), Name = "Multi 1 and 2", InventoryNamespaceId = dummyNs.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            var wsMulti23 = new Workspace { Id = Guid.NewGuid(), Name = "Multi 2 and 3", InventoryNamespaceId = dummyNs.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };

            db.Workspaces.AddRange(wsZero1, wsZero2, wsSoleU1_A, wsSoleU1_B, wsSoleU2, wsMulti12, wsMulti23);
            await db.SaveChangesAsync();

            db.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = wsSoleU1_A.Id, UserId = user1.Id, Role = WorkspaceRole.OWNER, CreatedAt = DateTimeOffset.UtcNow });
            db.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = wsSoleU1_B.Id, UserId = user1.Id, Role = WorkspaceRole.OWNER, CreatedAt = DateTimeOffset.UtcNow });
            db.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = wsSoleU2.Id, UserId = user2.Id, Role = WorkspaceRole.OWNER, CreatedAt = DateTimeOffset.UtcNow });

            db.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = wsMulti12.Id, UserId = user1.Id, Role = WorkspaceRole.OWNER, CreatedAt = DateTimeOffset.UtcNow });
            db.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = wsMulti12.Id, UserId = user2.Id, Role = WorkspaceRole.OWNER, CreatedAt = DateTimeOffset.UtcNow });

            db.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = wsMulti23.Id, UserId = user2.Id, Role = WorkspaceRole.OWNER, CreatedAt = DateTimeOffset.UtcNow });
            db.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = wsMulti23.Id, UserId = user3.Id, Role = WorkspaceRole.OWNER, CreatedAt = DateTimeOffset.UtcNow });

            await db.SaveChangesAsync();

            var nodeZero1 = new StorageNode { Id = Guid.NewGuid(), WorkspaceId = wsZero1.Id, Name = "Node Zero1", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            var nodeSoleU1_A = new StorageNode { Id = Guid.NewGuid(), WorkspaceId = wsSoleU1_A.Id, Name = "Node SoleU1 A", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            db.StorageNodes.AddRange(nodeZero1, nodeSoleU1_A);
            await db.SaveChangesAsync();

            var cZero = new Container { Id = Guid.NewGuid(), WorkspaceId = wsZero1.Id, StorageNodeId = nodeZero1.Id, BoxNumber = 5, InventoryNamespaceId = dummyNs.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
            var cSole = new Container { Id = Guid.NewGuid(), WorkspaceId = wsSoleU1_A.Id, StorageNodeId = nodeSoleU1_A.Id, BoxNumber = 12, InventoryNamespaceId = dummyNs.Id, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };

            db.Containers.AddRange(cZero, cSole);
            await db.SaveChangesAsync();

            var migrationSql = @"
                DO $$
                DECLARE
                    orphan_ws RECORD;
                    sole_owner_user RECORD;
                    multi_owner_ws RECORD;
                    co_owner RECORD;
                    new_ns_id UUID;
                    dup_row RECORD;
                    next_box INT;
                BEGIN
                    CREATE TEMP TABLE ws_owner_counts AS
                    SELECT workspace_id, COUNT(*) as owner_count
                    FROM workspace_members
                    WHERE role = 'OWNER'
                    GROUP BY workspace_id;

                    CREATE TEMP TABLE ws_owners AS
                    SELECT w.id as workspace_id, COALESCE(oc.owner_count, 0) as owner_count
                    FROM workspaces w
                    LEFT JOIN ws_owner_counts oc ON w.id = oc.workspace_id;

                    CREATE TEMP TABLE ws_namespace_assignments (
                        workspace_id UUID PRIMARY KEY,
                        namespace_id UUID
                    );

                    FOR orphan_ws IN 
                        SELECT workspace_id FROM ws_owners WHERE owner_count = 0
                    LOOP
                        new_ns_id := gen_random_uuid();
                        INSERT INTO inventory_namespaces (id, name, created_at, updated_at)
                        VALUES (new_ns_id, 'My Inventory', NOW(), NOW());
                        
                        INSERT INTO ws_namespace_assignments (workspace_id, namespace_id)
                        VALUES (orphan_ws.workspace_id, new_ns_id);
                    END LOOP;

                    FOR sole_owner_user IN
                        SELECT DISTINCT wm.user_id
                        FROM workspace_members wm
                        JOIN ws_owners o ON wm.workspace_id = o.workspace_id
                        WHERE wm.role = 'OWNER' AND o.owner_count = 1
                    LOOP
                        new_ns_id := gen_random_uuid();
                        INSERT INTO inventory_namespaces (id, name, created_at, updated_at)
                        VALUES (new_ns_id, 'My Inventory', NOW(), NOW());
                        
                        INSERT INTO inventory_namespace_members (inventory_namespace_id, user_id, role, created_at)
                        VALUES (new_ns_id, sole_owner_user.user_id, 'OWNER', NOW());
                        
                        INSERT INTO ws_namespace_assignments (workspace_id, namespace_id)
                        SELECT wm.workspace_id, new_ns_id
                        FROM workspace_members wm
                        JOIN ws_owners o ON wm.workspace_id = o.workspace_id
                        WHERE wm.role = 'OWNER' 
                          AND o.owner_count = 1 
                          AND wm.user_id = sole_owner_user.user_id;
                    END LOOP;

                    FOR multi_owner_ws IN
                        SELECT workspace_id FROM ws_owners WHERE owner_count > 1
                    LOOP
                        new_ns_id := gen_random_uuid();
                        INSERT INTO inventory_namespaces (id, name, created_at, updated_at)
                        VALUES (new_ns_id, 'My Inventory', NOW(), NOW());
                        
                        FOR co_owner IN
                            SELECT user_id 
                            FROM workspace_members 
                            WHERE workspace_id = multi_owner_ws.workspace_id AND role = 'OWNER'
                        LOOP
                            INSERT INTO inventory_namespace_members (inventory_namespace_id, user_id, role, created_at)
                            VALUES (new_ns_id, co_owner.user_id, 'OWNER', NOW())
                            ON CONFLICT (inventory_namespace_id, user_id) DO NOTHING;
                        END LOOP;
                        
                        INSERT INTO ws_namespace_assignments (workspace_id, namespace_id)
                        VALUES (multi_owner_ws.workspace_id, new_ns_id);
                    END LOOP;

                    UPDATE workspaces w
                    SET inventory_namespace_id = a.namespace_id
                    FROM ws_namespace_assignments a
                    WHERE w.id = a.workspace_id;

                    UPDATE containers c
                    SET inventory_namespace_id = w.inventory_namespace_id
                    FROM workspaces w
                    WHERE c.workspace_id = w.id;

                    FOR dup_row IN
                        SELECT c1.id, c1.inventory_namespace_id
                        FROM containers c1
                        WHERE EXISTS (
                            SELECT 1 FROM containers c2
                            WHERE c2.inventory_namespace_id = c1.inventory_namespace_id
                              AND c2.box_number = c1.box_number
                              AND (c2.created_at < c1.created_at OR (c2.created_at = c1.created_at AND c2.id < c1.id))
                        )
                        ORDER BY c1.created_at ASC, c1.id ASC
                    LOOP
                        SELECT COALESCE(MAX(box_number), 0) + 1 INTO next_box
                        FROM containers
                        WHERE inventory_namespace_id = dup_row.inventory_namespace_id;

                        UPDATE containers
                        SET box_number = next_box
                        WHERE id = dup_row.id;
                    END LOOP;

                    INSERT INTO inventory_namespace_box_counters (inventory_namespace_id, next_box_number)
                    SELECT
                        ns.id,
                        COALESCE(MAX(c.box_number), 0) + 1
                    FROM inventory_namespaces ns
                    LEFT JOIN containers c ON c.inventory_namespace_id = ns.id
                    GROUP BY ns.id
                    ON CONFLICT (inventory_namespace_id) DO UPDATE 
                    SET next_box_number = EXCLUDED.next_box_number;

                    DROP TABLE ws_owner_counts;
                    DROP TABLE ws_owners;
                    DROP TABLE ws_namespace_assignments;

                END $$;
            ";

            await db.Database.ExecuteSqlRawAsync(migrationSql);

            var dbWsZero1 = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == wsZero1.Id);
            var dbWsZero2 = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == wsZero2.Id);

            var dbWsSoleU1_A = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == wsSoleU1_A.Id);
            var dbWsSoleU1_B = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == wsSoleU1_B.Id);
            var dbWsSoleU2 = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == wsSoleU2.Id);

            var dbWsMulti12 = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == wsMulti12.Id);
            var dbWsMulti23 = await db.Workspaces.AsNoTracking().FirstAsync(w => w.Id == wsMulti23.Id);

            Assert.NotEqual(dbWsZero1.InventoryNamespaceId, dbWsZero2.InventoryNamespaceId);

            Assert.Equal(dbWsSoleU1_A.InventoryNamespaceId, dbWsSoleU1_B.InventoryNamespaceId);
            Assert.NotEqual(dbWsSoleU1_A.InventoryNamespaceId, dbWsSoleU2.InventoryNamespaceId);

            Assert.NotEqual(dbWsMulti12.InventoryNamespaceId, dbWsSoleU1_A.InventoryNamespaceId);
            Assert.NotEqual(dbWsMulti12.InventoryNamespaceId, dbWsMulti23.InventoryNamespaceId);

            var members12 = await db.InventoryNamespaceMembers
                .Where(m => m.InventoryNamespaceId == dbWsMulti12.InventoryNamespaceId)
                .ToListAsync();
            Assert.Equal(2, members12.Count);
            Assert.Contains(members12, m => m.UserId == user1.Id && m.Role == WorkspaceRole.OWNER);
            Assert.Contains(members12, m => m.UserId == user2.Id && m.Role == WorkspaceRole.OWNER);

            var members23 = await db.InventoryNamespaceMembers
                .Where(m => m.InventoryNamespaceId == dbWsMulti23.InventoryNamespaceId)
                .ToListAsync();
            Assert.Equal(2, members23.Count);
            Assert.Contains(members23, m => m.UserId == user2.Id && m.Role == WorkspaceRole.OWNER);
            Assert.Contains(members23, m => m.UserId == user3.Id && m.Role == WorkspaceRole.OWNER);

            var counterZero1 = await db.InventoryNamespaceBoxCounters.FindAsync(dbWsZero1.InventoryNamespaceId);
            Assert.NotNull(counterZero1);
            Assert.Equal(6, counterZero1.NextBoxNumber);

            var counterSoleU1 = await db.InventoryNamespaceBoxCounters.FindAsync(dbWsSoleU1_A.InventoryNamespaceId);
            Assert.NotNull(counterSoleU1);
            Assert.Equal(13, counterSoleU1.NextBoxNumber);

            var counterZero2 = await db.InventoryNamespaceBoxCounters.FindAsync(dbWsZero2.InventoryNamespaceId);
            Assert.NotNull(counterZero2);
            Assert.Equal(1, counterZero2.NextBoxNumber);
        }
        finally
        {
            await transaction.RollbackAsync();
        }
    }

    [Fact]
    public async Task TransferContainer_WithCaptureAndAIProcessingJob_SucceedsAndPreservesRelationships()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var transferService = scope.ServiceProvider.GetRequiredService<IContainerTransferService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var uid = $"transfer_ai_user_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(uid, "transferai@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Source Space"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Target Space"));

        var loc1 = await locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("Loc 1", null));
        var loc2 = await locationService.CreateLocationAsync(identity, ws2.Id, new CreateStorageLocationRequestDto("Loc 2", null));

        var container = await containerService.CreateContainerAsync(identity, ws1.Id, new CreateContainerRequestDto(loc1.Id, "Photo Box", null));

        // Create InventoryCapture + AIProcessingJob + DetectionSuggestion attached to container in ws1
        var captureId = Guid.NewGuid();
        var capture = new InventoryCapture
        {
            Id = captureId,
            WorkspaceId = ws1.Id,
            ContainerId = container.Id,
            Status = "COMPLETED",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.InventoryCaptures.Add(capture);

        var job = new AIProcessingJob
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            CaptureId = captureId,
            Status = "COMPLETED",
            AttemptCount = 1,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.AIProcessingJobs.Add(job);

        var suggestion = new DetectionSuggestion
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            CaptureId = captureId,
            Name = "Detected Book",
            Quantity = 1,
            Confidence = 0.95m,
            IsRemoved = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.DetectionSuggestions.Add(suggestion);
        await db.SaveChangesAsync();

        // Perform cross-workspace transfer
        var transferred = await transferService.TransferContainerAsync(
            identity,
            ws1.InventoryNamespaceId,
            container.Id,
            new TransferContainerRequestDto(ws2.Id, loc2.Id));

        Assert.NotNull(transferred);
        Assert.Equal(ws2.Id, transferred.WorkspaceId);
        Assert.Equal(loc2.Id, transferred.StorageNodeId);

        // Verify capture, job, and suggestion updated workspace_id to ws2 while preserving relationships
        var dbCapture = await db.InventoryCaptures.AsNoTracking().FirstOrDefaultAsync(c => c.Id == captureId);
        Assert.NotNull(dbCapture);
        Assert.Equal(ws2.Id, dbCapture.WorkspaceId);

        var dbJob = await db.AIProcessingJobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == job.Id);
        Assert.NotNull(dbJob);
        Assert.Equal(ws2.Id, dbJob.WorkspaceId);

        var dbSuggestion = await db.DetectionSuggestions.AsNoTracking().FirstOrDefaultAsync(s => s.Id == suggestion.Id);
        Assert.NotNull(dbSuggestion);
        Assert.Equal(ws2.Id, dbSuggestion.WorkspaceId);
    }

    [Fact]
    public async Task TransferContainer_WithImageAsset_SucceedsAndPreservesImageAssetWorkspaceId()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var transferService = scope.ServiceProvider.GetRequiredService<IContainerTransferService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var uid = $"transfer_img_user_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(uid, "transferimg@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Source Space Image"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Target Space Image"));

        var loc1 = await locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("Loc 1", null));
        var loc2 = await locationService.CreateLocationAsync(identity, ws2.Id, new CreateStorageLocationRequestDto("Loc 2", null));

        var container = await containerService.CreateContainerAsync(identity, ws1.Id, new CreateContainerRequestDto(loc1.Id, "Photo Box Image", null));

        var imageAsset = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            ContainerId = container.Id,
            ObjectPath = "captures/photo.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 1024,
            Status = "READY",
            ImagePurpose = "REFERENCE",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.ImageAssets.Add(imageAsset);
        await db.SaveChangesAsync();

        var transferred = await transferService.TransferContainerAsync(
            identity,
            ws1.InventoryNamespaceId,
            container.Id,
            new TransferContainerRequestDto(ws2.Id, loc2.Id));

        Assert.NotNull(transferred);
        Assert.Equal(ws2.Id, transferred.WorkspaceId);

        var dbImg = await db.ImageAssets.AsNoTracking().FirstOrDefaultAsync(i => i.Id == imageAsset.Id);
        Assert.NotNull(dbImg);
        Assert.Equal(ws2.Id, dbImg.WorkspaceId);
    }
}
