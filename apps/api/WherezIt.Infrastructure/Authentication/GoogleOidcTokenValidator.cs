using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Google.Apis.Auth;
using Microsoft.Extensions.Logging;
using WherezIt.Application.Authentication.Services;

namespace WherezIt.Infrastructure.Authentication;

public class GoogleOidcTokenValidator : IGoogleOidcTokenValidator
{
    private readonly ILogger<GoogleOidcTokenValidator> _logger;

    public GoogleOidcTokenValidator(ILogger<GoogleOidcTokenValidator> logger)
    {
        _logger = logger;
    }

    public async Task<OidcValidationResult> ValidateTokenAsync(
        string? authHeader,
        string expectedAudience,
        string allowedServiceAccount,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return new OidcValidationResult(false, OidcValidationResultStatus.MissingToken, ErrorMessage: "Missing or malformed Authorization header.");
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();
        if (string.IsNullOrWhiteSpace(token))
        {
            return new OidcValidationResult(false, OidcValidationResultStatus.MissingToken, ErrorMessage: "Empty bearer token.");
        }

        try
        {
            var validationSettings = new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = string.IsNullOrWhiteSpace(expectedAudience) ? null : new[] { expectedAudience }
            };

            var payload = await GoogleJsonWebSignature.ValidateAsync(token, validationSettings);

            if (payload == null)
            {
                return new OidcValidationResult(false, OidcValidationResultStatus.InvalidToken, ErrorMessage: "Failed to parse Google OIDC payload.");
            }

            var email = payload.Email;
            if (string.IsNullOrWhiteSpace(email))
            {
                // Fallback: check sub or account claims if email isn't directly populated
                email = payload.Subject;
            }

            if (!string.Equals(email, allowedServiceAccount, StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogWarning("SEC-004: OIDC token valid but caller {CallerEmail} does not match allowed service account {AllowedAccount}.", email, allowedServiceAccount);
                return new OidcValidationResult(false, OidcValidationResultStatus.ForbiddenIdentity, SubjectEmail: email, ErrorMessage: "Forbidden: Caller is not the authorized internal service account.");
            }

            return new OidcValidationResult(true, OidcValidationResultStatus.Success, SubjectEmail: email);
        }
        catch (InvalidJwtException ex)
        {
            _logger.LogWarning("SEC-004: Invalid Google OIDC token: {Message}", ex.Message);
            return new OidcValidationResult(false, OidcValidationResultStatus.InvalidToken, ErrorMessage: $"Invalid OIDC token: {ex.Message}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SEC-004: Unexpected error validating Google OIDC token.");
            return new OidcValidationResult(false, OidcValidationResultStatus.InvalidToken, ErrorMessage: "Token validation error.");
        }
    }
}
