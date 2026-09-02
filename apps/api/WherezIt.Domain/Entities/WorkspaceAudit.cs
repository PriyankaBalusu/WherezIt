using System;

namespace WherezIt.Domain.Entities;

public class WorkspaceAudit
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid WorkspaceId { get; set; }
    public string WorkspaceName { get; set; } = string.Empty;
    public Guid InventoryNamespaceId { get; set; }
    public string EventType { get; set; } = string.Empty; // WORKSPACE_CREATED, WORKSPACE_DELETED
    public string ActorUserId { get; set; } = string.Empty;
    public string AllowedUserIds { get; set; } = string.Empty; // Comma-separated user GUID strings
    public DateTimeOffset OccurredAt { get; set; } = DateTimeOffset.UtcNow;
    public string? DetailsJson { get; set; }
}
