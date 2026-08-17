namespace WherezIt.Domain.Entities;

public class Container
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid StorageNodeId { get; set; }
    public int BoxNumber { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public bool IsArchived { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Workspace Workspace { get; set; } = null!;
    public StorageNode StorageNode { get; set; } = null!;
}
