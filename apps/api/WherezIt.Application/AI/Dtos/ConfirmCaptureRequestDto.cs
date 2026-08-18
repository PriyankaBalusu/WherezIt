using System;
using System.Collections.Generic;

namespace WherezIt.Application.AI.Dtos;

public class ConfirmItemDto
{
    public string Name { get; set; } = null!;
    public int Quantity { get; set; } = 1;
    public Guid? SuggestionId { get; set; }
}

public class ConfirmCaptureRequestDto
{
    public List<ConfirmItemDto> Items { get; set; } = new();
}

public class ConfirmCaptureResponseDto
{
    public Guid CaptureId { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid ContainerId { get; set; }
    public string Status { get; set; } = "CONFIRMED";
    public int ConfirmedItemsCount { get; set; }
}
