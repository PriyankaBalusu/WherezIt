using System;

namespace WherezIt.Domain.Entities;

public class ImageAsset
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid? ContainerId { get; set; }
    public Guid? ItemId { get; set; }
    public string ObjectPath { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, READY, FAILED
    public string ImagePurpose { get; set; } = "REFERENCE"; // REFERENCE, PHYSICAL_LABEL, ITEM
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation properties
    public Container? Container { get; set; }
    public Item? Item { get; set; }
}
