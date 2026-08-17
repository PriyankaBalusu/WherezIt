using WherezIt.Infrastructure.Services;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class ImageObjectStorageTest
{
    [Fact]
    public async Task LocalDevStorage_UploadReadDelete_Succeeds()
    {
        var tempFolder = Path.Combine(Path.GetTempPath(), $"storage_test_{Guid.NewGuid():N}");
        try
        {
            var storage = new LocalDevImageObjectStorage(tempFolder);
            var workspaceId = Guid.NewGuid();

            var objectPath = storage.CreateObjectPath(workspaceId, "png");
            Assert.StartsWith($"{workspaceId:N}/", objectPath);
            Assert.EndsWith(".png", objectPath);

            var content = "Test Image Binary Bytes Content";
            using (var uploadStream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(content)))
            {
                await storage.UploadObjectAsync(objectPath, uploadStream, "image/png");
            }

            using (var readStream = await storage.OpenReadObjectAsync(objectPath))
            using (var reader = new StreamReader(readStream))
            {
                var readText = await reader.ReadToEndAsync();
                Assert.Equal(content, readText);
            }

            await storage.DeleteObjectAsync(objectPath);

            await Assert.ThrowsAsync<FileNotFoundException>(() => storage.OpenReadObjectAsync(objectPath));
        }
        finally
        {
            if (Directory.Exists(tempFolder))
            {
                Directory.Delete(tempFolder, recursive: true);
            }
        }
    }

    [Fact]
    public async Task LocalDevStorage_PathTraversalEscape_IsBlocked()
    {
        var tempFolder = Path.Combine(Path.GetTempPath(), $"storage_test_{Guid.NewGuid():N}");
        try
        {
            var storage = new LocalDevImageObjectStorage(tempFolder);
            var invalidPath = "../../../etc/passwd";

            using var dummyStream = new MemoryStream();

            var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                storage.UploadObjectAsync(invalidPath, dummyStream, "text/plain"));

            Assert.Contains("Path traversal escape detected", ex.Message);
        }
        finally
        {
            if (Directory.Exists(tempFolder))
            {
                Directory.Delete(tempFolder, recursive: true);
            }
        }
    }
}
