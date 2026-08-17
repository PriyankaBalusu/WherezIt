namespace WherezIt.Application.StorageLocations.Dtos;

public record StorageLocationResponseDto(
    Guid Id,
    Guid WorkspaceId,
    Guid? ParentId,
    string Name,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);
