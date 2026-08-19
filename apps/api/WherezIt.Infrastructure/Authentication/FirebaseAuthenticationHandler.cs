using System.Security.Claims;
using System.Text.Encodings.Web;
using FirebaseAdmin;
using FirebaseAdmin.Auth;
using Google.Apis.Auth.OAuth2;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace WherezIt.Infrastructure.Authentication;

public class FirebaseAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly string _projectId;

    public FirebaseAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IConfiguration configuration)
        : base(options, logger, encoder)
    {
        _projectId = configuration["Firebase:ProjectId"] ?? "wherezit-505615";

        EnsureFirebaseAppInitialized(_projectId);
    }

    private static void EnsureFirebaseAppInitialized(string projectId)
    {
        if (FirebaseApp.DefaultInstance == null)
        {
            try
            {
                FirebaseApp.Create(new AppOptions
                {
                    Credential = GoogleCredential.GetApplicationDefault(),
                    ProjectId = projectId
                });
            }
            catch
            {
                // Fallback for local development/testing without ADC file
                FirebaseApp.Create(new AppOptions
                {
                    Credential = GoogleCredential.FromAccessToken("placeholder-local-dev-token"),
                    ProjectId = projectId
                });
            }
        }
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("Authorization", out var authHeaderValues))
        {
            return AuthenticateResult.NoResult();
        }

        var authHeader = authHeaderValues.ToString();
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return AuthenticateResult.Fail("Invalid Authorization header format.");
        }

        var idToken = authHeader.Substring("Bearer ".Length).Trim();
        if (string.IsNullOrWhiteSpace(idToken))
        {
            return AuthenticateResult.Fail("Bearer token is empty.");
        }

        try
        {
            var authInstance = FirebaseAuth.DefaultInstance;
            if (authInstance == null)
            {
                return AuthenticateResult.Fail("Firebase Auth instance is not initialized.");
            }

            FirebaseToken decodedToken = await authInstance.VerifyIdTokenAsync(idToken, Context.RequestAborted);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, decodedToken.Uid),
                new Claim("user_id", decodedToken.Uid),
                new Claim("uid", decodedToken.Uid)
            };

            if (decodedToken.Claims.TryGetValue("email", out var emailObj) && emailObj is string emailStr)
            {
                claims.Add(new Claim(ClaimTypes.Email, emailStr));
                claims.Add(new Claim("email", emailStr));
            }

            if (decodedToken.Claims.TryGetValue("email_verified", out var verifiedObj))
            {
                claims.Add(new Claim("email_verified", verifiedObj?.ToString() ?? "false"));
            }

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, Scheme.Name);

            return AuthenticateResult.Success(ticket);
        }
        catch (FirebaseAuthException ex)
        {
            Logger.LogWarning(ex, "Firebase ID token verification failed.");
            return AuthenticateResult.Fail($"Firebase ID token validation failed: {ex.Message}");
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Unexpected error verifying Firebase token.");
            return AuthenticateResult.Fail("Authentication error.");
        }
    }
}
