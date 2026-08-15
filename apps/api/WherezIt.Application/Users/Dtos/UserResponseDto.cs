namespace WherezIt.Application.Users.Dtos;

public record UserResponseDto(
    Guid Id,
    string FirebaseUid,
    string? Email,
    bool EmailVerified,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);
