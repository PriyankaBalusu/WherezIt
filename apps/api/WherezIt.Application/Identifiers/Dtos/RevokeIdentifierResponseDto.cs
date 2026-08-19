using System;

namespace WherezIt.Application.Identifiers.Dtos;

public record RevokeIdentifierResponseDto(
    Guid IdentifierId,
    string Type,
    bool IsRevoked,
    DateTimeOffset? RevokedAt
);
