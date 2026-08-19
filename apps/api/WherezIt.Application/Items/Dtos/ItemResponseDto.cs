using System;

namespace WherezIt.Application.Items.Dtos;

public record ItemResponseDto(
    Guid Id,
    Guid WorkspaceId,
    Guid ContainerId,
    string Name,
    int Quantity,
    string? Category,
    string Source,
    bool IsVerified,
    bool IsArchived,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);
