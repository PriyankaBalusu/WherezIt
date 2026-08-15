namespace WherezIt.Application.Authentication;

public record AuthenticatedIdentity(
    string FirebaseUid,
    string? Email,
    bool EmailVerified
);
