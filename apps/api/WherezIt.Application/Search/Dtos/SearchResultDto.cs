using System;
using System.Collections.Generic;

namespace WherezIt.Application.Search.Dtos;

public class SearchResultDto
{
    public string ResultType { get; set; } = null!; // "ITEM" | "CONTAINER"
    
    // ITEM fields (nullable for CONTAINER)
    public Guid? ItemId { get; set; }
    public string? ItemName { get; set; }
    public int? Quantity { get; set; }

    // CONTAINER & Location fields
    public Guid ContainerId { get; set; }
    public int BoxNumber { get; set; }
    public string BoxDisplayId { get; set; } = null!;
    public Guid? LocationId { get; set; }
    public string? LocationName { get; set; }
    public IReadOnlyList<string> Breadcrumb { get; set; } = Array.Empty<string>();
    public string BreadcrumbDisplay { get; set; } = string.Empty;
}
