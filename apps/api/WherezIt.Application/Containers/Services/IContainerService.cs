using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;

namespace WherezIt.Application.Containers.Services;

public interface IContainerService
{
    Task<List<ContainerResponseDto>> GetContainersAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid? storageNodeId = null,
        bool includeArchived = false,
        CancellationToken cancellationToken = default);

    Task<ContainerResponseDto> GetContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default);

    Task<ContainerResponseDto> CreateContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        CreateContainerRequestDto request,
        CancellationToken cancellationToken = default);

    Task<ContainerResponseDto> UpdateContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        UpdateContainerRequestDto request,
        CancellationToken cancellationToken = default);

    Task<ContainerResponseDto> ArchiveContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default);

    Task<ContainerResponseDto> RestoreContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default);
}
