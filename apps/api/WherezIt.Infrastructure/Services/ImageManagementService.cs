using System;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WherezIt.Application.Authentication;
using WherezIt.Application.Images.Dtos;
using WherezIt.Application.Images.Services;
using WherezIt.Application.Storage.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class ImageManagementService : IImageManagementService
{
    private const long MaxFileSizeBytes = 10 * 1024 * 1024; // 10 MiB
    private static readonly string[] AllowedMimeTypes = { "image/jpeg", "image/png", "image/webp" };

    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authService;
    private readonly IImageObjectStorage _storage;
    private readonly ILogger<ImageManagementService> _logger;

    public ImageManagementService(
        WherezItDbContext dbContext,
        IWorkspaceAuthorizationService authService,
        IImageObjectStorage storage,
        ILogger<ImageManagementService> logger)
    {
        _dbContext = dbContext;
        _authService = authService;
        _storage = storage;
        _logger = logger;
    }

    public async Task<ImageUploadResponseDto> UploadContainerImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        Stream contentStream,
        string contentType,
        long length,
        CancellationToken cancellationToken = default)
    {
        // 1. Authenticate & Authorize Workspace Membership
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        // 2. Verify Container belongs to route Workspace
        var container = await _dbContext.Containers
            .FirstOrDefaultAsync(c => c.Id == containerId && c.WorkspaceId == workspaceId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException("Container not found in this workspace.");
        }

        // 3. Validate File Metadata
        if (length <= 0 || length > MaxFileSizeBytes)
        {
            throw new ArgumentException($"File size must be greater than 0 and less than or equal to {MaxFileSizeBytes} bytes.");
        }

        var normalizedContentType = contentType?.ToLowerInvariant().Trim();
        if (string.IsNullOrEmpty(normalizedContentType) || !AllowedMimeTypes.Contains(normalizedContentType))
        {
            throw new ArgumentException("Invalid content type. Only image/jpeg, image/png, and image/webp are allowed.");
        }

        // 4. Derive extension from Content-Type
        string extension = normalizedContentType switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => throw new ArgumentException("Unsupported image format.")
        };

        // 5. Generate ImageAsset ID and Object Path
        var imageId = Guid.NewGuid();
        var objectPath = $"workspaces/{workspaceId}/containers/{containerId}/{imageId}{extension}";
        var now = DateTimeOffset.UtcNow;

        var asset = new ImageAsset
        {
            Id = imageId,
            WorkspaceId = workspaceId,
            ContainerId = containerId,
            ObjectPath = objectPath,
            ContentType = normalizedContentType,
            SizeBytes = length,
            Status = "PENDING",
            CreatedAt = now,
            UpdatedAt = now
        };

        // 6. Persist PENDING metadata first (before GCS network upload)
        _dbContext.ImageAssets.Add(asset);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // 7. Upload Object using IImageObjectStorage
        try
        {
            await _storage.UploadObjectAsync(objectPath, contentStream, normalizedContentType, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Object storage upload failed for ImageAsset {ImageId} at path {ObjectPath}. Cleaning up PENDING metadata.", imageId, objectPath);
            // Option A Cleanup: remove PENDING metadata
            _dbContext.ImageAssets.Remove(asset);
            await _dbContext.SaveChangesAsync(cancellationToken);
            throw new InvalidOperationException("Failed to upload image object to storage.", ex);
        }

        // 8. Mark ImageAsset as READY after successful upload
        asset.Status = "READY";
        asset.UpdatedAt = DateTimeOffset.UtcNow;

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to update ImageAsset {ImageId} status to READY. Attempting compensating object deletion.", imageId);
            try
            {
                await _storage.DeleteObjectAsync(objectPath, CancellationToken.None);
                _logger.LogInformation("Compensating delete succeeded for object {ObjectPath}.", objectPath);
            }
            catch (Exception deleteEx)
            {
                _logger.LogError(deleteEx, "Compensating delete failed for object {ObjectPath}. Manual cleanup may be required.", objectPath);
            }
            throw new InvalidOperationException("Failed to finalize image record.", ex);
        }

        return new ImageUploadResponseDto
        {
            Id = asset.Id,
            WorkspaceId = asset.WorkspaceId,
            ContainerId = containerId,
            ContentType = asset.ContentType,
            SizeBytes = asset.SizeBytes,
            CreatedAt = asset.CreatedAt
        };
    }

    public async Task<(Stream Stream, string ContentType)?> GetImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid imageId,
        CancellationToken cancellationToken = default)
    {
        // 1. Authenticate & Authorize Workspace Membership
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        // 2. Fetch ImageAsset for workspace
        var asset = await _dbContext.ImageAssets
            .FirstOrDefaultAsync(x => x.Id == imageId && x.WorkspaceId == workspaceId, cancellationToken);

        // 3. Must be READY (PENDING, FAILED, or cross-workspace returns null / NotFound)
        if (asset == null || asset.Status != "READY")
        {
            return null;
        }

        // 4. Retrieve stream
        var stream = await _storage.OpenReadObjectAsync(asset.ObjectPath, cancellationToken);
        return (stream, asset.ContentType);
    }
}
