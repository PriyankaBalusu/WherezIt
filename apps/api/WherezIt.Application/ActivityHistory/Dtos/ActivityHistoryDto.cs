using System;

namespace WherezIt.Application.ActivityHistory.Dtos;

public record ActivityHistoryDto(
    Guid Id,
    string ActivityType,
    string Title,
    string Description,
    Guid ContainerId,
    Guid WorkspaceId,
    string ActorUserId,
    DateTimeOffset OccurredAt
);
