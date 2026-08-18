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

        var sampleBytes = Encoding.UTF8.GetBytes("fake-jpeg-binary-data");
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
}
