using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Items.Services;
using WherezIt.Application.Storage.Services;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Users.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using WherezIt.Infrastructure.Seed;
using Xunit;

namespace WherezIt.Infrastructure.Tests.Seed;

public class DemoDataSeedServiceTests
{
    private WherezItDbContext CreateTestDbContext()
    {
        var options = new DbContextOptionsBuilder<WherezItDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new WherezItDbContext(options);
    }

    [Fact]
    public async Task SeedDemoDataAsync_ThrowsInProductionWithoutEnvOptIn()
    {
        var dbContext = CreateTestDbContext();
        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Production");

        var userSvcMock = new Mock<IUserService>();
        var wsSvcMock = new Mock<IWorkspaceService>();
        var locSvcMock = new Mock<IStorageLocationService>();
        var containerSvcMock = new Mock<IContainerService>();
        var itemSvcMock = new Mock<IItemService>();
        var storageMock = new Mock<IImageObjectStorage>();

        var seeder = new DemoDataSeedService(
            envMock.Object,
            dbContext,
            userSvcMock.Object,
            wsSvcMock.Object,
            locSvcMock.Object,
            containerSvcMock.Object,
            itemSvcMock.Object,
            storageMock.Object,
            NullLogger<DemoDataSeedService>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            seeder.SeedDemoDataAsync("user-prod-1", "prod@wherezit.com"));
    }

    [Fact]
    public async Task CleanupDemoDataAsync_RemovesOnlyDemoSeedWorkspacesAndStorageObjects()
    {
        var dbContext = CreateTestDbContext();
        var envMock = new Mock<IHostEnvironment>();
        envMock.Setup(e => e.EnvironmentName).Returns("Development");

        var userUid = "test-user-123";

        var normalWs = new Workspace { Id = Guid.NewGuid(), Name = "My Real Home" };
        var demoWs = new Workspace { Id = Guid.NewGuid(), Name = "Demo Home [DEMO-SEED]" };

        dbContext.Workspaces.AddRange(normalWs, demoWs);
        dbContext.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = normalWs.Id, FirebaseUid = userUid, Role = "OWNER" });
        dbContext.WorkspaceMembers.Add(new WorkspaceMember { WorkspaceId = demoWs.Id, FirebaseUid = userUid, Role = "OWNER" });

        var demoItem = new Item { Id = Guid.NewGuid(), WorkspaceId = demoWs.Id, ContainerId = Guid.NewGuid(), Name = "Blender", Source = "DEMO-SEEDER" };
        var realItem = new Item { Id = Guid.NewGuid(), WorkspaceId = normalWs.Id, ContainerId = Guid.NewGuid(), Name = "Family Heirloom", Source = "MANUAL" };

        var demoImageAsset = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = demoWs.Id,
            ObjectPath = "test-workspace/demo-image.jpg",
            Status = "READY"
        };

        dbContext.Items.AddRange(demoItem, realItem);
        dbContext.ImageAssets.Add(demoImageAsset);
        await dbContext.SaveChangesAsync();

        var userSvcMock = new Mock<IUserService>();
        var wsSvcMock = new Mock<IWorkspaceService>();
        var locSvcMock = new Mock<IStorageLocationService>();
        var containerSvcMock = new Mock<IContainerService>();
        var itemSvcMock = new Mock<IItemService>();
        var storageMock = new Mock<IImageObjectStorage>();

        var seeder = new DemoDataSeedService(
            envMock.Object,
            dbContext,
            userSvcMock.Object,
            wsSvcMock.Object,
            locSvcMock.Object,
            containerSvcMock.Object,
            itemSvcMock.Object,
            storageMock.Object,
            NullLogger<DemoDataSeedService>.Instance);

        var result = await seeder.CleanupDemoDataAsync(userUid);

        Assert.True(result.Success);
        Assert.Equal(1, result.WorkspacesRemoved);
        Assert.Equal(1, result.ItemsRemoved);
        Assert.Equal(1, result.ImageAssetsRemoved);

        // Verify storage object deletion was called for demo asset
        storageMock.Verify(s => s.DeleteObjectAsync("test-workspace/demo-image.jpg", default), Times.Once);

        // Verify normal workspace remains intact
        var remainingWorkspaces = await dbContext.Workspaces.ToListAsync();
        Assert.Single(remainingWorkspaces);
        Assert.Equal("My Real Home", remainingWorkspaces[0].Name);

        var remainingItems = await dbContext.Items.ToListAsync();
        Assert.Single(remainingItems);
        Assert.Equal("Family Heirloom", remainingItems[0].Name);
    }
}
