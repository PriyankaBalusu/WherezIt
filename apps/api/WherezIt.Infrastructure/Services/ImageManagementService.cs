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

    private static string NormalizeContentType(string? contentType)
    {
        if (string.IsNullOrWhiteSpace(contentType)) return string.Empty;
        var trimmed = contentType.Split(';')[0].Trim().ToLowerInvariant();
        if (trimmed == "image/jpg" || trimmed == "image/pjpeg")
        {
            return "image/jpeg";
        }
        return trimmed;
    }

    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authService;
    private readonly IImageObjectStorage _storage;
    private readonly WherezIt.Application.AI.Services.IInventoryVisionProvider _visionProvider;
    private readonly ILogger<ImageManagementService> _logger;

    public ImageManagementService(
        WherezItDbContext dbContext,
        IWorkspaceAuthorizationService authService,
        IImageObjectStorage storage,
        WherezIt.Application.AI.Services.IInventoryVisionProvider visionProvider,
        ILogger<ImageManagementService> logger)
    {
        _dbContext = dbContext;
        _authService = authService;
        _storage = storage;
        _visionProvider = visionProvider;
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

        // 3. Validate File Metadata & Size Bounds
        if (length <= 0 || length > MaxFileSizeBytes)
        {
            throw new ArgumentException($"File size must be greater than 0 and less than or equal to {MaxFileSizeBytes} bytes.");
        }

        var normalizedContentType = NormalizeContentType(contentType);
        if (string.IsNullOrEmpty(normalizedContentType) || !AllowedMimeTypes.Contains(normalizedContentType))
        {
            throw new ArgumentException("Invalid content type. Only image/jpeg, image/png, and image/webp are allowed.");
        }

        // 4. SEC-003: Stream Preservation & Magic Byte Signature Validation
        Stream uploadStream = contentStream;
        MemoryStream? memoryStreamBuffer = null;

        if (!contentStream.CanSeek)
        {
            memoryStreamBuffer = new MemoryStream();
            await contentStream.CopyToAsync(memoryStreamBuffer, cancellationToken);
            if (memoryStreamBuffer.Length > MaxFileSizeBytes)
            {
                memoryStreamBuffer.Dispose();
                throw new ArgumentException($"File size exceeds maximum {MaxFileSizeBytes} bytes limit.");
            }
            memoryStreamBuffer.Position = 0;
            uploadStream = memoryStreamBuffer;
            length = memoryStreamBuffer.Length;
        }

        try
        {
            ValidateMagicBytes(uploadStream, normalizedContentType);
        }
        catch
        {
            memoryStreamBuffer?.Dispose();
            throw;
        }

        // 5. Derive extension from Content-Type
        string extension = normalizedContentType switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => throw new ArgumentException("Unsupported image format.")
        };

        // 6. Generate Server-Side ImageAsset ID and Object Path (Client Path Control = NO)
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
            ImagePurpose = "REFERENCE",
            CreatedAt = now,
            UpdatedAt = now
        };

        // 7. Persist PENDING metadata first (before GCS network upload)
        _dbContext.ImageAssets.Add(asset);
        await _dbContext.SaveChangesAsync(cancellationToken);

        // 8. Upload Object using IImageObjectStorage
        try
        {
            await _storage.UploadObjectAsync(objectPath, uploadStream, normalizedContentType, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Object storage upload failed for ImageAsset {ImageId} at path {ObjectPath}. Cleaning up PENDING metadata.", imageId, objectPath);
            _dbContext.ImageAssets.Remove(asset);
            await _dbContext.SaveChangesAsync(cancellationToken);
            memoryStreamBuffer?.Dispose();
            throw new InvalidOperationException("Failed to upload image object to storage.", ex);
        }
        finally
        {
            memoryStreamBuffer?.Dispose();
        }

        // 9. Mark ImageAsset as READY after successful upload
        asset.Status = "READY";
        asset.UpdatedAt = DateTimeOffset.UtcNow;

        _dbContext.ActivityHistories.Add(new ActivityHistory
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ActorUserId = identity.FirebaseUid,
            ActivityType = "PHOTO_ADDED",
            ContainerId = containerId,
            PreviousLocationDisplay = string.Empty,
            DestinationLocationDisplay = string.Empty,
            OccurredAt = DateTimeOffset.UtcNow
        });

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

        // 3. Must be READY
        if (asset == null || asset.Status != "READY")
        {
            return null;
        }

        // 4. Retrieve stream
        var stream = await _storage.OpenReadObjectAsync(asset.ObjectPath, cancellationToken);
        return (stream, asset.ContentType);
    }

    public async Task<System.Collections.Generic.IReadOnlyList<ContainerImageResponseDto>> GetContainerReferenceImagesAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == containerId && c.WorkspaceId == workspaceId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        var referenceImages = await _dbContext.ImageAssets
            .AsNoTracking()
            .Where(img => img.WorkspaceId == workspaceId &&
                          img.ContainerId == containerId &&
                          img.Status == "READY" &&
                          img.ImagePurpose == "REFERENCE")
            .OrderByDescending(img => img.CreatedAt)
            .ToListAsync(cancellationToken);

        return referenceImages.Select(img => new ContainerImageResponseDto(
            img.Id,
            img.WorkspaceId,
            img.ContainerId!.Value,
            img.ContentType,
            img.SizeBytes,
            img.CreatedAt,
            $"/api/v1/workspaces/{workspaceId}/images/{img.Id}"
        )).ToList();
    }

    public async Task DeleteContainerReferenceImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        Guid imageId,
        CancellationToken cancellationToken = default)
    {
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var asset = await _dbContext.ImageAssets
            .FirstOrDefaultAsync(img => img.Id == imageId && img.WorkspaceId == workspaceId && img.ContainerId == containerId, cancellationToken);

        if (asset == null)
        {
            throw new KeyNotFoundException($"Image '{imageId}' was not found for container '{containerId}' in workspace '{workspaceId}'.");
        }

        var isUsedInAiCapture = await _dbContext.InventoryCaptures
            .AnyAsync(ic => ic.ImageAssetId == imageId, cancellationToken);

        if (isUsedInAiCapture)
        {
            // Disassociate from container reference gallery while preserving ImageAsset and InventoryCapture audit history
            asset.ContainerId = null;
            asset.UpdatedAt = DateTimeOffset.UtcNow;
        }
        else
        {
            // Standalone reference photo: delete storage object and asset entity
            try
            {
                await _storage.DeleteObjectAsync(asset.ObjectPath, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete storage object at path {ObjectPath} during reference image deletion.", asset.ObjectPath);
            }

            _dbContext.ImageAssets.Remove(asset);
        }

        _dbContext.ActivityHistories.Add(new ActivityHistory
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ActorUserId = identity.FirebaseUid,
            ActivityType = "PHOTO_REMOVED",
            ContainerId = containerId,
            PreviousLocationDisplay = string.Empty,
            DestinationLocationDisplay = string.Empty,
            OccurredAt = DateTimeOffset.UtcNow
        });

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<ImageUploadResponseDto> UploadContainerPhysicalLabelImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        Stream contentStream,
        string contentType,
        long length,
        CancellationToken cancellationToken = default)
    {
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .FirstOrDefaultAsync(c => c.Id == containerId && c.WorkspaceId == workspaceId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException("Container not found in this workspace.");
        }

        if (length <= 0 || length > MaxFileSizeBytes)
        {
            throw new ArgumentException($"File size must be greater than 0 and less than or equal to {MaxFileSizeBytes} bytes.");
        }

        var normalizedContentType = NormalizeContentType(contentType);
        if (string.IsNullOrEmpty(normalizedContentType) || !AllowedMimeTypes.Contains(normalizedContentType))
        {
            throw new ArgumentException("Invalid content type. Only image/jpeg, image/png, and image/webp are allowed.");
        }

        // Find all existing physical label photos for this container if any exist (DO NOT delete yet)
        var existingLabelAssets = await _dbContext.ImageAssets
            .Where(img => img.WorkspaceId == workspaceId && img.ContainerId == containerId && img.ImagePurpose == "PHYSICAL_LABEL")
            .ToListAsync(cancellationToken);

        Stream uploadStream = contentStream;
        MemoryStream? memoryStreamBuffer = null;

        if (!contentStream.CanSeek)
        {
            memoryStreamBuffer = new MemoryStream();
            await contentStream.CopyToAsync(memoryStreamBuffer, cancellationToken);
            if (memoryStreamBuffer.Length > MaxFileSizeBytes)
            {
                memoryStreamBuffer.Dispose();
                throw new ArgumentException($"File size exceeds maximum {MaxFileSizeBytes} bytes limit.");
            }
            memoryStreamBuffer.Position = 0;
            uploadStream = memoryStreamBuffer;
            length = memoryStreamBuffer.Length;
        }

        try
        {
            ValidateMagicBytes(uploadStream, normalizedContentType);
        }
        catch
        {
            memoryStreamBuffer?.Dispose();
            throw;
        }

        string extension = normalizedContentType switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => throw new ArgumentException("Unsupported image format.")
        };

        var imageId = Guid.NewGuid();
        var objectPath = $"workspaces/{workspaceId}/containers/{containerId}/physical-label-{imageId}{extension}";
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
            ImagePurpose = "PHYSICAL_LABEL",
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.ImageAssets.Add(asset);
        await _dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            await _storage.UploadObjectAsync(objectPath, uploadStream, normalizedContentType, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Object storage upload failed for Physical Label ImageAsset {ImageId} at path {ObjectPath}.", imageId, objectPath);
            _dbContext.ImageAssets.Remove(asset);
            await _dbContext.SaveChangesAsync(cancellationToken);
            memoryStreamBuffer?.Dispose();
            throw new InvalidOperationException("Failed to upload physical label image object to storage.", ex);
        }
        finally
        {
            memoryStreamBuffer?.Dispose();
        }

        asset.Status = "READY";
        asset.UpdatedAt = DateTimeOffset.UtcNow;

        // If replacing an existing photo, clear old text and remove all old DB records in ONE transaction commit
        var oldObjectPathsToDelete = existingLabelAssets.Select(x => x.ObjectPath).ToList();
        if (existingLabelAssets.Count > 0)
        {
            _dbContext.ImageAssets.RemoveRange(existingLabelAssets);
            container.PhysicalLabel = null;
            container.UpdatedAt = DateTimeOffset.UtcNow;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        // Delete old storage objects ONLY AFTER new asset is committed DB READY
        foreach (var oldPath in oldObjectPathsToDelete)
        {
            try
            {
                await _storage.DeleteObjectAsync(oldPath, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete old physical label storage object at path {ObjectPath} post-commit.", oldPath);
            }
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

    public async Task<ContainerImageResponseDto?> GetContainerPhysicalLabelImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == containerId && c.WorkspaceId == workspaceId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        var labelAsset = await _dbContext.ImageAssets
            .AsNoTracking()
            .Where(img => img.WorkspaceId == workspaceId &&
                          img.ContainerId == containerId &&
                          img.ImagePurpose == "PHYSICAL_LABEL" &&
                          img.Status == "READY")
            .OrderByDescending(img => img.CreatedAt)
            .ThenByDescending(img => img.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (labelAsset == null) return null;

        return new ContainerImageResponseDto(
            labelAsset.Id,
            labelAsset.WorkspaceId,
            containerId,
            labelAsset.ContentType,
            labelAsset.SizeBytes,
            labelAsset.CreatedAt,
            $"/api/v1/workspaces/{workspaceId}/images/{labelAsset.Id}"
        );
    }

    public async Task DeleteContainerPhysicalLabelImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        await DeleteContainerExistingLabelAsync(identity, workspaceId, containerId, cancellationToken);
    }

    public async Task DeleteContainerExistingLabelAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .FirstOrDefaultAsync(c => c.Id == containerId && c.WorkspaceId == workspaceId, cancellationToken);

        if (container != null)
        {
            container.PhysicalLabel = null;
            container.UpdatedAt = DateTimeOffset.UtcNow;
        }

        var labelAssets = await _dbContext.ImageAssets
            .Where(img => img.WorkspaceId == workspaceId &&
                          img.ContainerId == containerId &&
                          img.ImagePurpose == "PHYSICAL_LABEL")
            .ToListAsync(cancellationToken);

        var oldObjectPathsToDelete = labelAssets.Select(x => x.ObjectPath).ToList();

        if (labelAssets.Count > 0)
        {
            _dbContext.ImageAssets.RemoveRange(labelAssets);
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        foreach (var oldPath in oldObjectPathsToDelete)
        {
            try
            {
                await _storage.DeleteObjectAsync(oldPath, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete storage object at path {ObjectPath} during physical label removal.", oldPath);
            }
        }
    }

    public async Task<string?> ExtractContainerPhysicalLabelOcrTextAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == containerId && c.WorkspaceId == workspaceId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        var labelAsset = await _dbContext.ImageAssets
            .AsNoTracking()
            .Where(img => img.WorkspaceId == workspaceId &&
                          img.ContainerId == containerId &&
                          img.ImagePurpose == "PHYSICAL_LABEL" &&
                          img.Status == "READY")
            .OrderByDescending(img => img.CreatedAt)
            .ThenByDescending(img => img.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (labelAsset == null)
        {
            throw new KeyNotFoundException("No physical label image found for this container.");
        }

        using var stream = await _storage.OpenReadObjectAsync(labelAsset.ObjectPath, cancellationToken);
        if (stream == null)
        {
            return null;
        }

        return await _visionProvider.ExtractLabelTextAsync(stream, labelAsset.ContentType, cancellationToken);
    }

    public async Task<ImageUploadResponseDto> UploadItemImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        Stream contentStream,
        string contentType,
        long length,
        CancellationToken cancellationToken = default)
    {
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .FirstOrDefaultAsync(i => i.Id == itemId && i.WorkspaceId == workspaceId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException("Item not found in this workspace.");
        }

        if (length <= 0 || length > MaxFileSizeBytes)
        {
            throw new ArgumentException($"File size must be greater than 0 and less than or equal to {MaxFileSizeBytes} bytes.");
        }

        var normalizedContentType = NormalizeContentType(contentType);
        if (string.IsNullOrEmpty(normalizedContentType) || !AllowedMimeTypes.Contains(normalizedContentType))
        {
            throw new ArgumentException("Invalid content type. Only image/jpeg, image/png, and image/webp are allowed.");
        }

        Stream uploadStream = contentStream;
        MemoryStream? memoryStreamBuffer = null;

        if (!contentStream.CanSeek)
        {
            memoryStreamBuffer = new MemoryStream();
            await contentStream.CopyToAsync(memoryStreamBuffer, cancellationToken);
            if (memoryStreamBuffer.Length > MaxFileSizeBytes)
            {
                memoryStreamBuffer.Dispose();
                throw new ArgumentException($"File size exceeds maximum {MaxFileSizeBytes} bytes limit.");
            }
            memoryStreamBuffer.Position = 0;
            uploadStream = memoryStreamBuffer;
            length = memoryStreamBuffer.Length;
        }

        try
        {
            ValidateMagicBytes(uploadStream, normalizedContentType);
        }
        catch
        {
            memoryStreamBuffer?.Dispose();
            throw;
        }

        string extension = normalizedContentType switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/webp" => ".webp",
            _ => throw new ArgumentException("Unsupported image format.")
        };

        var imageId = Guid.NewGuid();
        var objectPath = $"workspaces/{workspaceId}/items/{itemId}/{imageId}{extension}";
        var now = DateTimeOffset.UtcNow;

        var asset = new ImageAsset
        {
            Id = imageId,
            WorkspaceId = workspaceId,
            ItemId = itemId,
            ObjectPath = objectPath,
            ContentType = normalizedContentType,
            SizeBytes = length,
            Status = "PENDING",
            ImagePurpose = "ITEM",
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.ImageAssets.Add(asset);
        await _dbContext.SaveChangesAsync(cancellationToken);

        try
        {
            await _storage.UploadObjectAsync(objectPath, uploadStream, normalizedContentType, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Object storage upload failed for Item ImageAsset {ImageId} at path {ObjectPath}.", imageId, objectPath);
            _dbContext.ImageAssets.Remove(asset);
            await _dbContext.SaveChangesAsync(cancellationToken);
            memoryStreamBuffer?.Dispose();
            throw new InvalidOperationException("Failed to upload image object to storage.", ex);
        }
        finally
        {
            memoryStreamBuffer?.Dispose();
        }

        asset.Status = "READY";
        asset.UpdatedAt = DateTimeOffset.UtcNow;

        _dbContext.ActivityHistories.Add(new ActivityHistory
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ActorUserId = identity.FirebaseUid,
            ActivityType = "PHOTO_ADDED",
            ContainerId = item.ContainerId,
            PreviousLocationDisplay = string.Empty,
            DestinationLocationDisplay = item.Name,
            OccurredAt = DateTimeOffset.UtcNow
        });

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new ImageUploadResponseDto
        {
            Id = asset.Id,
            WorkspaceId = asset.WorkspaceId,
            ContainerId = item.ContainerId,
            ContentType = asset.ContentType,
            SizeBytes = asset.SizeBytes,
            CreatedAt = asset.CreatedAt
        };
    }

    public async Task<System.Collections.Generic.IReadOnlyList<ContainerImageResponseDto>> GetItemImagesAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default)
    {
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == itemId && i.WorkspaceId == workspaceId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Item '{itemId}' was not found in workspace '{workspaceId}'.");
        }

        var images = await _dbContext.ImageAssets
            .AsNoTracking()
            .Where(img => img.WorkspaceId == workspaceId &&
                          img.ItemId == itemId &&
                          img.Status == "READY" &&
                          img.ImagePurpose == "ITEM")
            .OrderByDescending(img => img.CreatedAt)
            .ToListAsync(cancellationToken);

        return images.Select(img => new ContainerImageResponseDto(
            img.Id,
            img.WorkspaceId,
            item.ContainerId,
            img.ContentType,
            img.SizeBytes,
            img.CreatedAt,
            $"/api/v1/workspaces/{workspaceId}/images/{img.Id}"
        )).ToList();
    }

    public async Task DeleteItemImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        Guid imageId,
        CancellationToken cancellationToken = default)
    {
        await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .FirstOrDefaultAsync(i => i.Id == itemId && i.WorkspaceId == workspaceId, cancellationToken);

        var asset = await _dbContext.ImageAssets
            .FirstOrDefaultAsync(img => img.Id == imageId && img.WorkspaceId == workspaceId && img.ItemId == itemId, cancellationToken);

        if (asset == null)
        {
            throw new KeyNotFoundException($"Image '{imageId}' was not found for item '{itemId}' in workspace '{workspaceId}'.");
        }

        try
        {
            await _storage.DeleteObjectAsync(asset.ObjectPath, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to delete storage object at path {ObjectPath} during item image deletion.", asset.ObjectPath);
        }

        _dbContext.ImageAssets.Remove(asset);

        if (item != null)
        {
            _dbContext.ActivityHistories.Add(new ActivityHistory
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                ActorUserId = identity.FirebaseUid,
                ActivityType = "PHOTO_REMOVED",
                ContainerId = item.ContainerId,
                PreviousLocationDisplay = string.Empty,
                DestinationLocationDisplay = item.Name,
                OccurredAt = DateTimeOffset.UtcNow
            });
        }

        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    private static void ValidateMagicBytes(Stream stream, string normalizedContentType)
    {
        var header = new byte[12];
        var originalPosition = stream.Position;
        int bytesRead = stream.Read(header, 0, header.Length);
        if (stream.CanSeek)
        {
            stream.Position = originalPosition;
        }

        if (bytesRead < 4)
        {
            throw new ArgumentException("Invalid image file signature or corrupted payload.");
        }

        bool isJpeg = bytesRead >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
        bool isPng = bytesRead >= 8 && header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 && header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A;
        bool isWebp = bytesRead >= 12 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46 && header[8] == 0x57 && header[9] == 0x45 && header[10] == 0x42 && header[11] == 0x50;

        string actualDetectedFormat = isJpeg ? "image/jpeg" : isPng ? "image/png" : isWebp ? "image/webp" : "unknown";

        if (actualDetectedFormat == "unknown")
        {
            throw new ArgumentException("Unsupported image file signature or corrupted payload.");
        }

        if (actualDetectedFormat != normalizedContentType)
        {
            throw new ArgumentException($"Declared Content-Type '{normalizedContentType}' does not match actual file signature '{actualDetectedFormat}'.");
        }
    }
}
