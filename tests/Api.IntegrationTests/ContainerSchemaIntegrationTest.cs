using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using WherezIt.Api.IntegrationTests.Fixtures;
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

        var wsA = new Workspace { Id = Guid.NewGuid(), Name = "Workspace A", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var wsB = new Workspace { Id = Guid.NewGuid(), Name = "Workspace B", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };

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
    public async Task WorkspaceBoxCounter_DefaultValue_AndSchemaVerification()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var ws = new Workspace { Id = Guid.NewGuid(), Name = "Counter WS", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        dbContext.Workspaces.Add(ws);
        await dbContext.SaveChangesAsync();

        var counter = new WorkspaceBoxCounter { WorkspaceId = ws.Id };
        dbContext.WorkspaceBoxCounters.Add(counter);
        await dbContext.SaveChangesAsync();

        var dbCounter = await dbContext.WorkspaceBoxCounters.FirstOrDefaultAsync(c => c.WorkspaceId == ws.Id);
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
        Assert.Equal(6, tableNames.Count);
    }
}
