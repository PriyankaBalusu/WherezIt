using WherezIt.Application.Storage.Services;

namespace WherezIt.Infrastructure.Services;

public class LocalDevImageObjectStorage : IImageObjectStorage
{
    private readonly string _basePath;

    public LocalDevImageObjectStorage(string? basePath = null)
    {
        _basePath = basePath ?? Path.Combine(Directory.GetCurrentDirectory(), "temp_storage");
        Directory.CreateDirectory(_basePath);
    }

    public string CreateObjectPath(Guid workspaceId, string extension)
    {
        var cleanExt = extension.TrimStart('.').ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(cleanExt)) cleanExt = "jpg";
        return $"{workspaceId:N}/{Guid.NewGuid():N}.{cleanExt}";
    }

    public async Task UploadObjectAsync(string objectPath, Stream data, string contentType, CancellationToken cancellationToken = default)
    {
        var fullPath = ResolveFullPath(objectPath);
        var dir = Path.GetDirectoryName(fullPath);
        if (!string.IsNullOrEmpty(dir))
        {
            Directory.CreateDirectory(dir);
        }

        using var fileStream = File.Create(fullPath);
        await data.CopyToAsync(fileStream, cancellationToken);
    }

    public Task<Stream> OpenReadObjectAsync(string objectPath, CancellationToken cancellationToken = default)
    {
        var fullPath = ResolveFullPath(objectPath);
        if (!File.Exists(fullPath))
        {
            throw new FileNotFoundException($"Storage object '{objectPath}' was not found.");
        }

        Stream stream = File.OpenRead(fullPath);
        return Task.FromResult(stream);
    }

    public Task DeleteObjectAsync(string objectPath, CancellationToken cancellationToken = default)
    {
        var fullPath = ResolveFullPath(objectPath);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
        return Task.CompletedTask;
    }

    private string ResolveFullPath(string objectPath)
    {
        if (string.IsNullOrWhiteSpace(objectPath))
        {
            throw new ArgumentException("Object path cannot be empty.", nameof(objectPath));
        }

        // Normalize slashes
        var normalizedPath = objectPath.Replace('\\', '/');
        var combinedPath = Path.Combine(_basePath, normalizedPath);
        var fullPath = Path.GetFullPath(combinedPath);

        var fullBasePath = Path.GetFullPath(_basePath);

        if (!fullPath.StartsWith(fullBasePath, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Path traversal escape detected for object path '{objectPath}'.");
        }

        return fullPath;
    }
}
