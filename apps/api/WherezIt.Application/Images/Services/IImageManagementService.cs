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
}
