using System;

namespace WherezIt.Application.ActivityHistory.Dtos;

public record ActivityHistoryDto(
    Guid Id,
    string ActivityType,
    Guid ContainerId,
    Guid? PreviousStorageNodeId,
    string PreviousLocationDisplay,
    Guid? DestinationStorageNodeId,
    string DestinationLocationDisplay,
    string ActorUserId,
    DateTimeOffset OccurredAt
);
