using System;
using System.Collections.Generic;

namespace WherezIt.Application.Identifiers.Dtos;

public class ResolvedContainerItemDto
{
    public Guid ItemId { get; set; }
    public string Name { get; set; } = null!;
    public int Quantity { get; set; }
}

public class ResolvedContainerDto
{
    public Guid ContainerId { get; set; }
    public Guid WorkspaceId { get; set; }
    public int BoxNumber { get; set; }
    public string BoxDisplayId { get; set; } = null!;
    public Guid StorageNodeId { get; set; }
    public string LocationName { get; set; } = null!;
    public string BreadcrumbDisplay { get; set; } = null!;
    public List<ResolvedContainerItemDto> Items { get; set; } = new();
}
