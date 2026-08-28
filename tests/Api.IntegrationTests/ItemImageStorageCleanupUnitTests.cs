using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using WherezIt.Application.Authentication;
using WherezIt.Application.Storage.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Domain.Enums;
using WherezIt.Infrastructure.Persistence;
using WherezIt.Infrastructure.Services;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class TestFakeStorage : IImageObjectStorage
{
    public List<string> DeletedPaths { get; } = new();

    public string CreateObjectPath(Guid workspaceId, string extension) => $"workspaces/{workspaceId}/{Guid.NewGuid()}.{extension}";

    public Task UploadObjectAsync(string objectPath, System.IO.Stream data, string contentType, CancellationToken cancellationToken = default)
    {
        return Task.CompletedTask;
    }

    public Task<System.IO.Stream> OpenReadObjectAsync(string objectPath, CancellationToken cancellationToken = default)
    {
        return Task.FromResult<System.IO.Stream>(new System.IO.MemoryStream(new byte[] { 0x00 }));
    }

    public Task DeleteObjectAsync(string objectPath, CancellationToken cancellationToken = default)
    {
        DeletedPaths.Add(objectPath);
        return Task.CompletedTask;
    }
}

public class TestFakeAuthService : IWorkspaceAuthorizationService
{
    public bool ThrowOnMembershipCheck { get; set; } = false;

    public Task<bool> IsWorkspaceMemberAsync(Guid userId, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(!ThrowOnMembershipCheck);
    }

    public Task RequireWorkspaceMembershipAsync(Guid userId, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        if (ThrowOnMembershipCheck) throw new UnauthorizedAccessException("User is not a member of this workspace.");
        return Task.CompletedTask;
    }

    public Task<bool> IsWorkspaceMemberAsync(AuthenticatedIdentity identity, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        return Task.FromResult(!ThrowOnMembershipCheck);
    }

    public Task RequireWorkspaceMembershipAsync(AuthenticatedIdentity identity, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        if (ThrowOnMembershipCheck) throw new UnauthorizedAccessException("User is not a member of this workspace.");
        return Task.CompletedTask;
    }

    public Task<WorkspaceRole?> GetWorkspaceRoleAsync(Guid userId, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        return Task.FromResult<WorkspaceRole?>(WorkspaceRole.OWNER);
    }

    public Task<WorkspaceRole?> GetWorkspaceRoleAsync(AuthenticatedIdentity identity, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        return Task.FromResult<WorkspaceRole?>(WorkspaceRole.OWNER);
    }
}

public class ItemImageStorageCleanupUnitTests
{
    private WherezItDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<WherezItDbContext>()
            .UseInMemoryDatabase(databaseName: $"ItemImageTestDb_{Guid.NewGuid()}")
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options;

        return new WherezItDbContext(options);
    }

    [Fact]
    public async Task A_PermanentDelete_ArchivedItemWithImages_RemovesDbRowsAndDeletesStorageObjects()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();

        var workspaceId = Guid.NewGuid();
        var containerId = Guid.NewGuid();
        var itemId = Guid.NewGuid();

        var item = new Item
        {
            Id = itemId,
            WorkspaceId = workspaceId,
            ContainerId = containerId,
            Name = "Archived Winter Coat",
            Quantity = 1,
            Source = "MANUAL",
            IsVerified = true,
            IsArchived = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var img1Path = $"workspaces/{workspaceId}/items/{itemId}/img1.jpg";
        var img2Path = $"workspaces/{workspaceId}/items/{itemId}/img2.jpg";

        var img1 = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ItemId = itemId,
            ObjectPath = img1Path,
            ContentType = "image/jpeg",
            SizeBytes = 1024,
            Status = "READY",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var img2 = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ItemId = itemId,
            ObjectPath = img2Path,
            ContentType = "image/jpeg",
            SizeBytes = 2048,
            Status = "READY",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        context.Items.Add(item);
        context.ImageAssets.AddRange(img1, img2);
        await context.SaveChangesAsync();

        var fakeStorage = new TestFakeStorage();
        var fakeAuth = new TestFakeAuthService();

        var itemService = new ItemService(
            context,
            fakeAuth,
            fakeStorage,
            NullLogger<ItemService>.Instance);

        var identity = new AuthenticatedIdentity("user-123", "owner@wherezit.dev", true);

        // Act
        await itemService.DeleteItemAsync(identity, workspaceId, itemId);

        // Assert
        var deletedItem = await context.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        Assert.Null(deletedItem);

        var remainingImages = await context.ImageAssets.Where(img => img.ItemId == itemId).ToListAsync();
        Assert.Empty(remainingImages);

        Assert.Contains(img1Path, fakeStorage.DeletedPaths);
        Assert.Contains(img2Path, fakeStorage.DeletedPaths);
        Assert.Equal(2, fakeStorage.DeletedPaths.Count);
    }

    [Fact]
    public async Task B_ArchiveItem_RetainsItemAndImageAssets_DoesNotInvokeStorageDelete()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();

        var workspaceId = Guid.NewGuid();
        var containerId = Guid.NewGuid();
        var itemId = Guid.NewGuid();

        var item = new Item
        {
            Id = itemId,
            WorkspaceId = workspaceId,
            ContainerId = containerId,
            Name = "Active Camping Tent",
            Quantity = 1,
            Source = "MANUAL",
            IsVerified = true,
            IsArchived = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var img = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ItemId = itemId,
            ObjectPath = $"workspaces/{workspaceId}/items/{itemId}/tent.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 4096,
            Status = "READY",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        context.Items.Add(item);
        context.ImageAssets.Add(img);
        await context.SaveChangesAsync();

        var fakeStorage = new TestFakeStorage();
        var fakeAuth = new TestFakeAuthService();
        var itemService = new ItemService(
            context,
            fakeAuth,
            fakeStorage,
            NullLogger<ItemService>.Instance);

        var identity = new AuthenticatedIdentity("user-123", "owner@wherezit.dev", true);

        // Act
        var result = await itemService.ArchiveItemAsync(identity, workspaceId, itemId);

        // Assert
        Assert.True(result.IsArchived);

        var dbItem = await context.Items.FirstOrDefaultAsync(i => i.Id == itemId);
        Assert.NotNull(dbItem);
        Assert.True(dbItem.IsArchived);

        var dbImage = await context.ImageAssets.FirstOrDefaultAsync(i => i.ItemId == itemId);
        Assert.NotNull(dbImage);

        Assert.Empty(fakeStorage.DeletedPaths);
    }

    [Fact]
    public async Task C_RestoreItem_RestoresArchivedItem_RetainsAssociatedImageAssets()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();

        var workspaceId = Guid.NewGuid();
        var containerId = Guid.NewGuid();
        var itemId = Guid.NewGuid();

        var item = new Item
        {
            Id = itemId,
            WorkspaceId = workspaceId,
            ContainerId = containerId,
            Name = "Archived Sleeping Bag",
            Quantity = 1,
            Source = "MANUAL",
            IsVerified = true,
            IsArchived = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var img = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ItemId = itemId,
            ObjectPath = $"workspaces/{workspaceId}/items/{itemId}/bag.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 2048,
            Status = "READY",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        context.Items.Add(item);
        context.ImageAssets.Add(img);
        await context.SaveChangesAsync();

        var fakeStorage = new TestFakeStorage();
        var fakeAuth = new TestFakeAuthService();
        var itemService = new ItemService(
            context,
            fakeAuth,
            fakeStorage,
            NullLogger<ItemService>.Instance);

        var identity = new AuthenticatedIdentity("user-123", "owner@wherezit.dev", true);

        // Act
        var result = await itemService.RestoreItemAsync(identity, workspaceId, itemId);

        // Assert
        Assert.False(result.IsArchived);

        var dbImage = await context.ImageAssets.FirstOrDefaultAsync(i => i.ItemId == itemId);
        Assert.NotNull(dbImage);
        Assert.Empty(fakeStorage.DeletedPaths);
    }

    [Fact]
    public async Task D_DirectItemPhotoDelete_RemovesOnlyTargetImage_AndInvokesStorageDelete()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();

        var workspaceId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        var imageId1 = Guid.NewGuid();
        var imageId2 = Guid.NewGuid();
        var path1 = $"workspaces/{workspaceId}/items/{itemId}/photo1.jpg";
        var path2 = $"workspaces/{workspaceId}/items/{itemId}/photo2.jpg";

        var img1 = new ImageAsset
        {
            Id = imageId1,
            WorkspaceId = workspaceId,
            ItemId = itemId,
            ObjectPath = path1,
            ContentType = "image/jpeg",
            SizeBytes = 1000,
            Status = "READY",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var img2 = new ImageAsset
        {
            Id = imageId2,
            WorkspaceId = workspaceId,
            ItemId = itemId,
            ObjectPath = path2,
            ContentType = "image/jpeg",
            SizeBytes = 2000,
            Status = "READY",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        context.ImageAssets.AddRange(img1, img2);
        await context.SaveChangesAsync();

        var fakeStorage = new TestFakeStorage();
        var fakeAuth = new TestFakeAuthService();

        var imageService = new ImageManagementService(
            context,
            fakeAuth,
            fakeStorage,
            null!,
            NullLogger<ImageManagementService>.Instance);

        var identity = new AuthenticatedIdentity("user-123", "owner@wherezit.dev", true);

        // Act - Delete image 1 only
        await imageService.DeleteItemImageAsync(identity, workspaceId, itemId, imageId1);

        // Assert
        var dbImg1 = await context.ImageAssets.FirstOrDefaultAsync(i => i.Id == imageId1);
        Assert.Null(dbImg1);

        var dbImg2 = await context.ImageAssets.FirstOrDefaultAsync(i => i.Id == imageId2);
        Assert.NotNull(dbImg2);

        Assert.Single(fakeStorage.DeletedPaths);
        Assert.Contains(path1, fakeStorage.DeletedPaths);
        Assert.DoesNotContain(path2, fakeStorage.DeletedPaths);
    }

    [Fact]
    public async Task E_TenantIsolation_UserCannotDeleteOtherWorkspaceItemImage()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();

        var targetWorkspaceId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        var imageId = Guid.NewGuid();
        var secretPath = $"workspaces/{targetWorkspaceId}/items/{itemId}/secret.jpg";

        var img = new ImageAsset
        {
            Id = imageId,
            WorkspaceId = targetWorkspaceId,
            ItemId = itemId,
            ObjectPath = secretPath,
            ContentType = "image/jpeg",
            SizeBytes = 1000,
            Status = "READY",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        context.ImageAssets.Add(img);
        await context.SaveChangesAsync();

        var fakeStorage = new TestFakeStorage();
        var fakeAuth = new TestFakeAuthService { ThrowOnMembershipCheck = true };

        var imageService = new ImageManagementService(
            context,
            fakeAuth,
            fakeStorage,
            null!,
            NullLogger<ImageManagementService>.Instance);

        var attackerIdentity = new AuthenticatedIdentity("attacker-999", "attacker@evil.dev", true);

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            imageService.DeleteItemImageAsync(attackerIdentity, targetWorkspaceId, itemId, imageId));

        var dbImg = await context.ImageAssets.FirstOrDefaultAsync(i => i.Id == imageId);
        Assert.NotNull(dbImg);

        Assert.Empty(fakeStorage.DeletedPaths);
    }
}
