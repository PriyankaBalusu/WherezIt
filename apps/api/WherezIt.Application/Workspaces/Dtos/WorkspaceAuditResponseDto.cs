using System;

namespace WherezIt.Application.Workspaces.Dtos;

public record WorkspaceAuditResponseDto(
    Guid Id,
    Guid WorkspaceId,
    string WorkspaceName,
    Guid InventoryNamespaceId,
    string EventType,
    string ActorUserId,
    DateTimeOffset OccurredAt,
    string? DetailsJson
);
