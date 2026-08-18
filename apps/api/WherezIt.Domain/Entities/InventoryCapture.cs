using System;
using System.Collections.Generic;

namespace WherezIt.Domain.Entities;

public class InventoryCapture
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid ContainerId { get; set; }
    public Guid ImageAssetId { get; set; }
    public string Status { get; set; } = "UPLOADED"; // UPLOADED, QUEUED, PROCESSING, REVIEW_REQUIRED, CONFIRMED, FAILED
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation properties
    public Container Container { get; set; } = null!;
    public ImageAsset ImageAsset { get; set; } = null!;
    public ICollection<DetectionSuggestion> Suggestions { get; set; } = new List<DetectionSuggestion>();
    public ICollection<AIProcessingJob> Jobs { get; set; } = new List<AIProcessingJob>();
}
