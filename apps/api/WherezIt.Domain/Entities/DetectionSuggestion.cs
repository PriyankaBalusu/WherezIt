using System;

namespace WherezIt.Domain.Entities;

public class DetectionSuggestion
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid CaptureId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; } = 1;
    public decimal? Confidence { get; set; }
    public bool IsRemoved { get; set; } = false;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation properties
    public InventoryCapture Capture { get; set; } = null!;
}
