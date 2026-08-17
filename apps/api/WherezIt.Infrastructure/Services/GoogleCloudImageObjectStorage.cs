using Google.Cloud.Storage.V1;
using WherezIt.Application.Storage.Services;

namespace WherezIt.Infrastructure.Services;

public class GoogleCloudImageObjectStorage : IImageObjectStorage
{
    private readonly StorageClient _storageClient;
    private readonly string _bucketName;

    public GoogleCloudImageObjectStorage(StorageClient storageClient, string bucketName)
    {
        _storageClient = storageClient ?? throw new ArgumentNullException(nameof(storageClient));
        _bucketName = string.IsNullOrWhiteSpace(bucketName) ? "wherezit-505615-images-dev" : bucketName;
    }

    public string CreateObjectPath(Guid workspaceId, string extension)
    {
        var cleanExt = extension.TrimStart('.').ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(cleanExt)) cleanExt = "jpg";
        return $"{workspaceId:N}/{Guid.NewGuid():N}.{cleanExt}";
    }

    public async Task UploadObjectAsync(string objectPath, Stream data, string contentType, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(objectPath)) throw new ArgumentException("Object path cannot be empty.", nameof(objectPath));
        if (data == null) throw new ArgumentNullException(nameof(data));

        await _storageClient.UploadObjectAsync(
            _bucketName,
            objectPath,
            contentType,
            data,
            cancellationToken: cancellationToken);
    }

    public async Task<Stream> OpenReadObjectAsync(string objectPath, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(objectPath)) throw new ArgumentException("Object path cannot be empty.", nameof(objectPath));

        var memoryStream = new MemoryStream();
        await _storageClient.DownloadObjectAsync(
            _bucketName,
            objectPath,
            memoryStream,
            cancellationToken: cancellationToken);

        memoryStream.Position = 0;
        return memoryStream;
    }

    public async Task DeleteObjectAsync(string objectPath, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(objectPath)) throw new ArgumentException("Object path cannot be empty.", nameof(objectPath));

        await _storageClient.DeleteObjectAsync(_bucketName, objectPath, cancellationToken: cancellationToken);
    }
}
