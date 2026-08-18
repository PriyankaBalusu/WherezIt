using System;

namespace WherezIt.Application.Images.Dtos;

public class ImageUploadResponseDto
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid ContainerId { get; set; }
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
