namespace WherezIt.Application.Workspaces.Dtos;

public record WorkspaceResponseDto(
    Guid Id,
    string Name,
    string Role,
    DateTimeOffset CreatedAt
);
