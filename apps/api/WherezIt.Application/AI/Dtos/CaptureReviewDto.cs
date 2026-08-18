using System;
using System.Collections.Generic;

namespace WherezIt.Application.AI.Dtos;

public class DetectionSuggestionDto
{
    public Guid Id { get; set; }
    public string SuggestedName { get; set; } = null!;
    public int SuggestedQuantity { get; set; }
    public double ConfidenceScore { get; set; }
}

public class CaptureReviewResponseDto
{
    public Guid CaptureId { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid ContainerId { get; set; }
    public int BoxNumber { get; set; }
    public string BoxDisplayId { get; set; } = null!;
    public Guid ImageId { get; set; }
    public string Status { get; set; } = null!; // "PROCESSING" | "FAILED" | "REVIEW_REQUIRED" | "CONFIRMED"
    public string BreadcrumbDisplay { get; set; } = string.Empty;
    public string? FailureReason { get; set; }
    public IReadOnlyList<DetectionSuggestionDto> Suggestions { get; set; } = Array.Empty<DetectionSuggestionDto>();
}
