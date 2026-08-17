namespace WherezIt.Domain.Entities;

public class StorageNode
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid? ParentId { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public Workspace Workspace { get; set; } = null!;
    public StorageNode? Parent { get; set; }
    public ICollection<StorageNode> Children { get; set; } = new List<StorageNode>();
}
