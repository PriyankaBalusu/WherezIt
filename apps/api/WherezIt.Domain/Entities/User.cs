namespace WherezIt.Domain.Entities;

public class User
{
    public Guid Id { get; set; }
    public string FirebaseUid { get; set; } = string.Empty;
    public string? Email { get; set; }
    public bool EmailVerified { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}
