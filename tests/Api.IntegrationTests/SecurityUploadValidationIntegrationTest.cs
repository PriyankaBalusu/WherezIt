using System;
using System.IO;
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
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class SecurityUploadValidationIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public SecurityUploadValidationIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task UploadValidation_EnforcesMagicBytes_MimeMatching_AndSizeBounds()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var imageService = scope.ServiceProvider.GetRequiredService<IImageManagementService>();

        var identity = new AuthenticatedIdentity($"sec003_user_{Guid.NewGuid():N}", "sec003@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("SEC003 WS"));
        var loc = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Lab", null));
        var container = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(loc.Id, "Secure Box", null));

        // 1. Valid JPEG (FF D8 FF ...)
        byte[] validJpegBytes = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01 };
        using (var stream = new MemoryStream(validJpegBytes))
        {
            var res = await imageService.UploadContainerImageAsync(identity, ws.Id, container.Id, stream, "image/jpeg", stream.Length);
            Assert.NotNull(res);
            Assert.Equal("image/jpeg", res.ContentType);
        }

        // 2. Valid PNG (89 50 4E 47 0D 0A 1A 0A)
        byte[] validPngBytes = new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D };
        using (var stream = new MemoryStream(validPngBytes))
        {
            var res = await imageService.UploadContainerImageAsync(identity, ws.Id, container.Id, stream, "image/png", stream.Length);
            Assert.NotNull(res);
            Assert.Equal("image/png", res.ContentType);
        }

        // 3. Valid WebP (RIFF .... WEBP)
        byte[] validWebpBytes = new byte[] { 0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50 };
        using (var stream = new MemoryStream(validWebpBytes))
        {
            var res = await imageService.UploadContainerImageAsync(identity, ws.Id, container.Id, stream, "image/webp", stream.Length);
            Assert.NotNull(res);
            Assert.Equal("image/webp", res.ContentType);
        }

        // 4. MIME/signature mismatch: declared image/jpeg but payload has PNG bytes -> REJECTED
        using (var stream = new MemoryStream(validPngBytes))
        {
            await Assert.ThrowsAsync<ArgumentException>(() =>
                imageService.UploadContainerImageAsync(identity, ws.Id, container.Id, stream, "image/jpeg", stream.Length));
        }

        // 5. Fake JPEG: declared image/jpeg with random non-JPEG bytes -> REJECTED
        byte[] fakeJpegBytes = new byte[] { 0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xAA, 0xBB };
        using (var stream = new MemoryStream(fakeJpegBytes))
        {
            await Assert.ThrowsAsync<ArgumentException>(() =>
                imageService.UploadContainerImageAsync(identity, ws.Id, container.Id, stream, "image/jpeg", stream.Length));
        }

        // 6. Size bounds: > 10 MiB -> REJECTED
        long oversized = 10 * 1024 * 1024 + 1;
        using (var stream = new MemoryStream(validJpegBytes))
        {
            await Assert.ThrowsAsync<ArgumentException>(() =>
                imageService.UploadContainerImageAsync(identity, ws.Id, container.Id, stream, "image/jpeg", oversized));
        }
    }
}
