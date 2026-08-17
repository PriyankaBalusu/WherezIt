namespace WherezIt.Application.Storage.Services;

public interface IImageObjectStorage
{
    string CreateObjectPath(Guid workspaceId, string extension);
    Task UploadObjectAsync(string objectPath, Stream data, string contentType, CancellationToken cancellationToken = default);
    Task<Stream> OpenReadObjectAsync(string objectPath, CancellationToken cancellationToken = default);
    Task DeleteObjectAsync(string objectPath, CancellationToken cancellationToken = default);
}
