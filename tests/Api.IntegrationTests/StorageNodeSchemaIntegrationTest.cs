using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class StorageNodeSchemaIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public StorageNodeSchemaIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task StorageNode_SameWorkspace_Hierarchy_Succeeds()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var workspace = new Workspace
        {
            Id = Guid.NewGuid(),
            Name = "Home Workspace",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        dbContext.Workspaces.Add(workspace);
        await dbContext.SaveChangesAsync();

        var garage = new StorageNode
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspace.Id,
            ParentId = null,
            Name = "Garage",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var rack = new StorageNode
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspace.Id,
            ParentId = garage.Id,
            Name = "Rack A",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var shelf = new StorageNode
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspace.Id,
            ParentId = rack.Id,
            Name = "Shelf 2",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        dbContext.StorageNodes.AddRange(garage, rack, shelf);
        await dbContext.SaveChangesAsync();

        var dbNodes = await dbContext.StorageNodes
            .Where(n => n.WorkspaceId == workspace.Id)
            .ToListAsync();

        Assert.Equal(3, dbNodes.Count);
    }

    [Fact]
    public async Task StorageNode_CrossWorkspaceParent_FailsDatabaseForeignKeyConstraint()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var wsA = new Workspace { Id = Guid.NewGuid(), Name = "Workspace A", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var wsB = new Workspace { Id = Guid.NewGuid(), Name = "Workspace B", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };

        dbContext.Workspaces.AddRange(wsA, wsB);
        await dbContext.SaveChangesAsync();

        var nodeA = new StorageNode
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsA.Id,
            ParentId = null,
            Name = "Garage in A",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        dbContext.StorageNodes.Add(nodeA);
        await dbContext.SaveChangesAsync();

        // Attempting to make Node B in Workspace B have Node A (in Workspace A) as parent
        var nodeB = new StorageNode
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsB.Id,
            ParentId = nodeA.Id, // Node A belongs to Workspace A, but Node B claims Workspace B
            Name = "Shelf in B attempting to reference Garage in A",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        dbContext.StorageNodes.Add(nodeB);
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());

        Assert.NotNull(ex.InnerException);
        Assert.IsType<PostgresException>(ex.InnerException);
        var pgEx = (PostgresException)ex.InnerException;
        Assert.Equal("23503", pgEx.SqlState); // Foreign key violation
        Assert.Contains("FK_storage_nodes_storage_nodes_workspace_id_parent_id", pgEx.ConstraintName);
    }

    [Fact]
    public async Task StorageNode_DeleteParentWithChildren_FailsRestrictConstraint()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var workspace = new Workspace { Id = Guid.NewGuid(), Name = "Restrict WS", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        dbContext.Workspaces.Add(workspace);
        await dbContext.SaveChangesAsync();

        var parent = new StorageNode { Id = Guid.NewGuid(), WorkspaceId = workspace.Id, ParentId = null, Name = "Parent", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var child = new StorageNode { Id = Guid.NewGuid(), WorkspaceId = workspace.Id, ParentId = parent.Id, Name = "Child", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };

        dbContext.StorageNodes.AddRange(parent, child);
        await dbContext.SaveChangesAsync();

        dbContext.StorageNodes.Remove(parent);
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());

        Assert.NotNull(ex.InnerException);
        Assert.IsType<PostgresException>(ex.InnerException);
        Assert.Equal("23503", ((PostgresException)ex.InnerException).SqlState);
    }

    [Fact]
    public void Migration_Schema_ContainsStorageNodesTable()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var tableNames = dbContext.Model.GetEntityTypes().Select(e => e.GetTableName()).ToList();

        Assert.Contains("users", tableNames);
        Assert.Contains("workspaces", tableNames);
        Assert.Contains("workspace_members", tableNames);
        Assert.Contains("storage_nodes", tableNames);
        Assert.Equal(4, tableNames.Count);
    }
}
