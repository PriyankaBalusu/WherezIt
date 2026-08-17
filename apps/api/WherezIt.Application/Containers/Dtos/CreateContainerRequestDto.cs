namespace WherezIt.Application.Containers.Dtos;

public record CreateContainerRequestDto(
    Guid StorageNodeId,
    string? Name,
    string? Description
);
