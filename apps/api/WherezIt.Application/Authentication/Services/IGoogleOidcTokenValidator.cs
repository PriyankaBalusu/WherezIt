using System.Threading;
using System.Threading.Tasks;

namespace WherezIt.Application.Authentication.Services;

public enum OidcValidationResultStatus
{
    Success,
    MissingToken,
    InvalidToken,
    WrongAudience,
    WrongIssuer,
    ForbiddenIdentity
}

public record OidcValidationResult(
    bool IsSuccess,
    OidcValidationResultStatus Status,
    string? SubjectEmail = null,
    string? ErrorMessage = null
);

public interface IGoogleOidcTokenValidator
{
    Task<OidcValidationResult> ValidateTokenAsync(
        string? authHeader,
        string expectedAudience,
        string allowedServiceAccount,
        CancellationToken cancellationToken = default);
}
