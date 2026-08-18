using System;

namespace WherezIt.Domain.Entities;

public class AIProcessingJob
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid CaptureId { get; set; }
    public string Status { get; set; } = "QUEUED"; // QUEUED, RUNNING, COMPLETED, FAILED
    public int AttemptCount { get; set; } = 0;
    public string? LastError { get; set; }
    public string? InputMetadata { get; set; } // stored as jsonb in postgres
    public string? OutputMetadata { get; set; } // stored as jsonb in postgres
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation properties
    public InventoryCapture Capture { get; set; } = null!;
}
