using System;

namespace WherezIt.Domain.Entities;

public class Identifier
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid ContainerId { get; set; }
    public string Type { get; set; } = null!; // "QR" | "BARCODE"
    public string Value { get; set; } = null!;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Workspace Workspace { get; set; } = null!;
    public Container Container { get; set; } = null!;
}
