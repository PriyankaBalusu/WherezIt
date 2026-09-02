using System;

namespace WherezIt.Application.Workspaces.Dtos;

public record WorkspaceResponseDto(
    Guid Id,
    string Name,
    string Role,
    DateTimeOffset CreatedAt,
    Guid InventoryNamespaceId,
    int MemberCount = 1,
    int OwnerCount = 1
);
