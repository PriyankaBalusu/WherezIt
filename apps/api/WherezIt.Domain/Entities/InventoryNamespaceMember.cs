using System;
using WherezIt.Domain.Enums;

namespace WherezIt.Domain.Entities;

public class InventoryNamespaceMember
{
    public Guid InventoryNamespaceId { get; set; }
    public Guid UserId { get; set; }
    public WorkspaceRole Role { get; set; }
    public DateTimeOffset CreatedAt { get; set; }

    public InventoryNamespace InventoryNamespace { get; set; } = null!;
    public User User { get; set; } = null!;
}
