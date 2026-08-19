using System;

namespace WherezIt.Application.Containers.Dtos;

public record UpdateContainerRequestDto(
    string? Name,
    string? Description,
    Guid? DestinationStorageNodeId = null,
    bool? IsPacked = null,
    string? MovingPriority = null
);
