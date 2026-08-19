using System;

namespace WherezIt.Domain.Entities;

public class ActivityHistory
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public string ActorUserId { get; set; } = null!;
    public string ActivityType { get; set; } = null!;
    public Guid ContainerId { get; set; }
    public Guid? PreviousStorageNodeId { get; set; }
    public Guid? DestinationStorageNodeId { get; set; }
    public string PreviousLocationDisplay { get; set; } = null!;
    public string DestinationLocationDisplay { get; set; } = null!;
    public DateTimeOffset OccurredAt { get; set; }

    public Workspace Workspace { get; set; } = null!;
    public Container Container { get; set; } = null!;
    public StorageNode? PreviousStorageNode { get; set; }
    public StorageNode? DestinationStorageNode { get; set; }
}
