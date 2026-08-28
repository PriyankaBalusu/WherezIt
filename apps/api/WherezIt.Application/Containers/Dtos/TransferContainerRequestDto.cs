using System;

namespace WherezIt.Application.Containers.Dtos;

public record TransferContainerRequestDto(
    Guid DestinationWorkspaceId,
    Guid DestinationStorageNodeId
);
