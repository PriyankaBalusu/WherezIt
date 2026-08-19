using System;

namespace WherezIt.Application.Containers.Dtos;

public record CreateContainerRequestDto(
    Guid StorageNodeId,
    string? Name,
    string? Description,
    Guid? DestinationStorageNodeId = null,
    bool? IsPacked = null,
    string? MovingPriority = null
);
