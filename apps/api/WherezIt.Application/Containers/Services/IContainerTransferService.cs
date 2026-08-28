using System;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;

namespace WherezIt.Application.Containers.Services;

public interface IContainerTransferService
{
    Task<ContainerResponseDto> TransferContainerAsync(
        AuthenticatedIdentity identity,
        Guid inventoryNamespaceId,
        Guid containerId,
        TransferContainerRequestDto request,
        CancellationToken cancellationToken = default);
}
