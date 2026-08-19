namespace WherezIt.Domain.Entities;

public class Item
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid ContainerId { get; set; }
    public string Name { get; set; } = null!;
    public int Quantity { get; set; } = 1;
    public string? Category { get; set; }
    public string Source { get; set; } = null!;
    public bool IsVerified { get; set; }
    public bool IsArchived { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Workspace Workspace { get; set; } = null!;
    public Container Container { get; set; } = null!;
}
