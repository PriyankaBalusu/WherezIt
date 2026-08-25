using System;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.Authentication;
using WherezIt.Application.Images.Dtos;

namespace WherezIt.Application.Images.Services;

public interface IImageManagementService
{
    Task<ImageUploadResponseDto> UploadContainerImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        Stream contentStream,
        string contentType,
        long length,
        CancellationToken cancellationToken = default);

    Task<(Stream Stream, string ContentType)?> GetImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid imageId,
        CancellationToken cancellationToken = default);

    Task<System.Collections.Generic.IReadOnlyList<ContainerImageResponseDto>> GetContainerReferenceImagesAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default);

    Task DeleteContainerReferenceImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        Guid imageId,
        CancellationToken cancellationToken = default);

    Task<ImageUploadResponseDto> UploadItemImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        Stream contentStream,
        string contentType,
        long length,
        CancellationToken cancellationToken = default);

    Task<System.Collections.Generic.IReadOnlyList<ContainerImageResponseDto>> GetItemImagesAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default);

    Task DeleteItemImageAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        Guid imageId,
        CancellationToken cancellationToken = default);
}
