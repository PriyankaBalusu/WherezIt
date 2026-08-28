using System;

namespace WherezIt.Domain.Entities;

public class InventoryNamespaceBoxCounter
{
    public Guid InventoryNamespaceId { get; set; }
    public int NextBoxNumber { get; set; }

    public InventoryNamespace InventoryNamespace { get; set; } = null!;
}
