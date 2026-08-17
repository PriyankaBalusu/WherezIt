namespace WherezIt.Application.StorageLocations.Dtos;

public record BreadcrumbResponseDto(
    Guid WorkspaceId,
    string WorkspaceName,
    Guid LocationId,
    List<BreadcrumbSegmentDto> Segments,
    string DisplayPath
);
