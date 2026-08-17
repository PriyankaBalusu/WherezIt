namespace WherezIt.Application.StorageLocations.Dtos;

public record CreateStorageLocationRequestDto(
    string Name,
    Guid? ParentId
);
