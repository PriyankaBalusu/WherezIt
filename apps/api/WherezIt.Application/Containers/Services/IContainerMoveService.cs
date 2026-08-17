using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;

namespace WherezIt.Application.Containers.Services;

public interface IContainerMoveService
{
    Task<ContainerResponseDto> MoveContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        MoveContainerRequestDto request,
        CancellationToken cancellationToken = default);
}
