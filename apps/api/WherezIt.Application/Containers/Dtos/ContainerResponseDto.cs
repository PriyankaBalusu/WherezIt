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
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);
