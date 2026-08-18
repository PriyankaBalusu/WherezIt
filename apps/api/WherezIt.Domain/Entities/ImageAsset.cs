using System;

namespace WherezIt.Domain.Entities;

public class ImageAsset
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid? ContainerId { get; set; }
    public string ObjectPath { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string Status { get; set; } = "PENDING"; // PENDING, READY, FAILED
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    // Navigation properties
    public Container? Container { get; set; }
}
