using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Items.Services;
using WherezIt.Application.Seed.Services;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class DemoSeedIntegrationTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public DemoSeedIntegrationTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task DemoSeed_CreatesDeterministicData_PreservesAllocator_AndIsIdempotent()
    {
        using var scope = _fixture.Services.CreateScope();
        var seedService = scope.ServiceProvider.GetRequiredService<IDemoSeedService>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = "seed-test-user-1";
        var identity = new AuthenticatedIdentity(testUid, "seed@test.user", true);

        // 1. Execute Seed
        var result1 = await seedService.SeedDemoDataAsync(testUid, "seed@test.user");
        Assert.True(result1.Success);
        Assert.Equal("Demo Home Workspace", result1.WorkspaceName);
        Assert.Equal(4, result1.LocationsCreated);
        Assert.Equal(2, result1.ContainersCreated);
        Assert.Equal(5, result1.ItemsCreated);

        // Verify Workspace
        var userWorkspaces = await workspaceService.GetUserWorkspacesAsync(identity);
        var ws = userWorkspaces.FirstOrDefault(w => w.Id == Guid.Parse(result1.WorkspaceId));
        Assert.NotNull(ws);
        Assert.Equal("Demo Home Workspace", ws.Name);

        // Verify Locations
        var locations = await locationService.GetLocationsAsync(identity, ws.Id);
        Assert.Equal(4, locations.Count);

        // Verify Containers and Box Allocator
        var containers = await containerService.GetContainersAsync(identity, ws.Id);
        Assert.Equal(2, containers.Count);
        Assert.Contains(containers, c => c.BoxId == "BOX 001" && c.Name == "Holiday Decorations" && c.IsPacked && c.MovingPriority == "HIGH");
        Assert.Contains(containers, c => c.BoxId == "BOX 002" && c.Name == "Camping Gear" && !c.IsPacked && c.MovingPriority == "MEDIUM");

        // Verify Items & Categories
        var box1 = containers.First(c => c.BoxId == "BOX 001");
        var itemsInBox1 = await itemService.GetItemsByContainerAsync(identity, ws.Id, box1.Id);
        Assert.Equal(3, itemsInBox1.Count);
        Assert.Contains(itemsInBox1, i => i.Name == "Christmas Lights" && i.Category == "Holiday Decor" && i.Quantity == 2);

        // 2. Idempotent rerun: execute seed again
        var result2 = await seedService.SeedDemoDataAsync(testUid, "seed@test.user");
        Assert.True(result2.Success);
        Assert.Equal(0, result2.ContainersCreated);

        // Verify counts remain unchanged (0 duplicates)
        var containersAfterRerun = await containerService.GetContainersAsync(identity, ws.Id);
        Assert.Equal(2, containersAfterRerun.Count);
    }
}
