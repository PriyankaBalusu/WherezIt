using System;
using System.Collections.Generic;

namespace WherezIt.Domain.Entities;

public class InventoryNamespace
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }

    public ICollection<Workspace> Workspaces { get; set; } = new List<Workspace>();
    public ICollection<InventoryNamespaceMember> Members { get; set; } = new List<InventoryNamespaceMember>();
    public InventoryNamespaceBoxCounter? BoxCounter { get; set; }
}
