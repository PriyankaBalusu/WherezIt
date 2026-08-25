using System;

namespace WherezIt.Application.Images.Dtos;

public record ContainerImageResponseDto(
    Guid Id,
    Guid WorkspaceId,
    Guid ContainerId,
    string ContentType,
    long SizeBytes,
    DateTimeOffset CreatedAt,
    string Url
);
