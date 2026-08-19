using System;

namespace WherezIt.Application.Containers.Dtos;

public record ContainerResponseDto(
    Guid Id,
    Guid WorkspaceId,
    Guid StorageNodeId,
    int BoxNumber,
    string BoxId,
    string? Name,
    string? Description,
    bool IsArchived,
    Guid? DestinationStorageNodeId,
    bool IsPacked,
    string? MovingPriority,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);
