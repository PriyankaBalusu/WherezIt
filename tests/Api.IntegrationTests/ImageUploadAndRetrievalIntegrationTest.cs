using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Images.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class ImageUploadAndRetrievalIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public ImageUploadAndRetrievalIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task AuthorizedUploadAndRetrieval_Succeeds()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var imageService = scope.ServiceProvider.GetRequiredService<IImageManagementService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"img_user_{Guid.NewGuid():N}", "img_user@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Image WS"));
        var loc = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Storage Bay", null));
        var container = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(loc.Id, "Bin A", null));

        var sampleBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01 };
        using var uploadStream = new MemoryStream(sampleBytes);

        // Act: Upload
        var uploadResult = await imageService.UploadContainerImageAsync(
            identity, ws.Id, container.Id, uploadStream, "image/jpeg", sampleBytes.Length);

        Assert.NotNull(uploadResult);
        Assert.Equal(ws.Id, uploadResult.WorkspaceId);
        Assert.Equal(container.Id, uploadResult.ContainerId);
        Assert.Equal("image/jpeg", uploadResult.ContentType);
        Assert.Equal(sampleBytes.Length, uploadResult.SizeBytes);

        // Verify DB status is READY
        var assetInDb = await db.ImageAssets.FindAsync(uploadResult.Id);
        Assert.NotNull(assetInDb);
        Assert.Equal("READY", assetInDb!.Status);

        // Act: Retrieve
        var retrieveResult = await imageService.GetImageAsync(identity, ws.Id, uploadResult.Id);
        Assert.NotNull(retrieveResult);
        Assert.Equal("image/jpeg", retrieveResult!.Value.ContentType);

        using var memoryStream = new MemoryStream();
        await retrieveResult.Value.Stream.CopyToAsync(memoryStream);
        Assert.Equal(sampleBytes, memoryStream.ToArray());
    }

    [Fact]
    public async Task CrossWorkspaceUpload_ThrowsKeyNotFoundException()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var imageService = scope.ServiceProvider.GetRequiredService<IImageManagementService>();

        var identity = new AuthenticatedIdentity($"cross_img_user_{Guid.NewGuid():N}", "cross_img@example.com", true);
        var ws1 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("WS1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("WS2"));
        var loc = await locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("Loc", null));
        var containerInWs1 = await containerService.CreateContainerAsync(identity, ws1.Id, new CreateContainerRequestDto(loc.Id, "Bin WS1", null));

        var bytes = Encoding.UTF8.GetBytes("data");
        using var stream = new MemoryStream(bytes);

        // Attempting to upload to WS2 route with container in WS1
        await Assert.ThrowsAsync<KeyNotFoundException>(async () =>
        {
            await imageService.UploadContainerImageAsync(identity, ws2.Id, containerInWs1.Id, stream, "image/png", bytes.Length);
        });
    }

    [Fact]
    public async Task InvalidMimeTypeOrOversized_ThrowsArgumentException()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var imageService = scope.ServiceProvider.GetRequiredService<IImageManagementService>();

        var identity = new AuthenticatedIdentity($"invalid_img_user_{Guid.NewGuid():N}", "invalid_img@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Validation WS"));
        var loc = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Loc", null));
        var container = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(loc.Id, "Bin 1", null));

        var bytes = Encoding.UTF8.GetBytes("data");
        using var stream = new MemoryStream(bytes);

        // Invalid MIME type
        await Assert.ThrowsAsync<ArgumentException>(async () =>
        {
            await imageService.UploadContainerImageAsync(identity, ws.Id, container.Id, stream, "application/pdf", bytes.Length);
        });

        // Oversized (>10MB)
        await Assert.ThrowsAsync<ArgumentException>(async () =>
        {
            await imageService.UploadContainerImageAsync(identity, ws.Id, container.Id, stream, "image/jpeg", 11 * 1024 * 1024);
        });
    }

    [Fact]
    public async Task NonReadyImage_RetrievalReturnsNull()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var imageService = scope.ServiceProvider.GetRequiredService<IImageManagementService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"pending_img_user_{Guid.NewGuid():N}", "pending_img@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Pending WS"));

        var pendingAsset = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws.Id,
            ObjectPath = "path/pending.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 100,
            Status = "PENDING",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.ImageAssets.Add(pendingAsset);
        await db.SaveChangesAsync();

        // Act
        var result = await imageService.GetImageAsync(identity, ws.Id, pendingAsset.Id);

        // Assert: Non-READY asset returns null
        Assert.Null(result);
    }

    [Fact]
    public async Task ReferencePhotoListingAndDelete_ExcludesAiCaptures_And_EnforcesTenancy()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var imageService = scope.ServiceProvider.GetRequiredService<IImageManagementService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var userA = new AuthenticatedIdentity($"b3_user_a_{Guid.NewGuid():N}", "usera@b3.test", true);
        var userB = new AuthenticatedIdentity($"b3_user_b_{Guid.NewGuid():N}", "userb@b3.test", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(userA, new CreateWorkspaceRequestDto("B3 WS A"));
        var wsB = await workspaceService.CreateWorkspaceAsync(userB, new CreateWorkspaceRequestDto("B3 WS B"));

        var locA = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Loc A", null));
        var containerA = await containerService.CreateContainerAsync(userA, wsA.Id, new CreateContainerRequestDto(locA.Id, "Box A", "Desc A"));

        var sampleBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01 };

        // 1. Upload reference photo
        using var stream1 = new MemoryStream(sampleBytes);
        var refPhoto1 = await imageService.UploadContainerImageAsync(userA, wsA.Id, containerA.Id, stream1, "image/jpeg", sampleBytes.Length);

        // 2. Upload photo intended for AI capture
        using var stream2 = new MemoryStream(sampleBytes);
        var aiPhoto = await imageService.UploadContainerImageAsync(userA, wsA.Id, containerA.Id, stream2, "image/jpeg", sampleBytes.Length);

        // Link aiPhoto to an InventoryCapture
        var capture = new InventoryCapture
        {
            Id = Guid.NewGuid(),
            WorkspaceId = wsA.Id,
            ContainerId = containerA.Id,
            ImageAssetId = aiPhoto.Id,
            Status = "UPLOADED",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.InventoryCaptures.Add(capture);
        await db.SaveChangesAsync();

        // 3. List reference photos -> includes refPhoto1, EXCLUDES aiPhoto
        var refPhotos = await imageService.GetContainerReferenceImagesAsync(userA, wsA.Id, containerA.Id);
        Assert.Single(refPhotos);
        Assert.Equal(refPhoto1.Id, refPhotos[0].Id);

        // 4. Attempt to delete AI capture photo via reference delete endpoint -> InvalidOperationException
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            imageService.DeleteContainerReferenceImageAsync(userA, wsA.Id, containerA.Id, aiPhoto.Id));

        // 5. User B (unauthorized) attempt to list or delete reference photo -> UnauthorizedAccessException
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            imageService.GetContainerReferenceImagesAsync(userB, wsA.Id, containerA.Id));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            imageService.DeleteContainerReferenceImageAsync(userB, wsA.Id, containerA.Id, refPhoto1.Id));

        // 6. Delete reference photo -> succeeds
        await imageService.DeleteContainerReferenceImageAsync(userA, wsA.Id, containerA.Id, refPhoto1.Id);

        // 7. Reference photo list is now empty
        var refPhotosAfterDelete = await imageService.GetContainerReferenceImagesAsync(userA, wsA.Id, containerA.Id);
        Assert.Empty(refPhotosAfterDelete);
    }
}
