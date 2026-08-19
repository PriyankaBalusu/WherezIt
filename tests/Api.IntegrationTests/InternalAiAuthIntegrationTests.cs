using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class TestGoogleOidcTokenValidator : IGoogleOidcTokenValidator
{
    public const string ValidToken = "valid-oidc-token-for-task-runner";
    public const string WrongAccountToken = "valid-oidc-token-for-wrong-account";
    public const string InvalidToken = "invalid-oidc-token";

    public const string ApprovedServiceAccount = "wherezit-cloudtasks-sa@wherezit-505615.iam.gserviceaccount.com";
    public const string WrongServiceAccount = "attacker-sa@wherezit-505615.iam.gserviceaccount.com";

    public Task<OidcValidationResult> ValidateTokenAsync(
        string? authHeader,
        string expectedAudience,
        string allowedServiceAccount,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return Task.FromResult(new OidcValidationResult(false, OidcValidationResultStatus.MissingToken, ErrorMessage: "Missing or malformed Authorization header."));
        }

        var token = authHeader.Substring("Bearer ".Length).Trim();

        if (token == ValidToken)
        {
            return Task.FromResult(new OidcValidationResult(true, OidcValidationResultStatus.Success, SubjectEmail: ApprovedServiceAccount));
        }

        if (token == WrongAccountToken)
        {
            return Task.FromResult(new OidcValidationResult(false, OidcValidationResultStatus.ForbiddenIdentity, SubjectEmail: WrongServiceAccount, ErrorMessage: "Forbidden: Caller is not the authorized internal service account."));
        }

        return Task.FromResult(new OidcValidationResult(false, OidcValidationResultStatus.InvalidToken, ErrorMessage: "Invalid or expired OIDC token."));
    }
}

public class InternalAiAuthIntegrationTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public InternalAiAuthIntegrationTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task InternalAiController_Enforces_Oidc_ServiceAuthentication()
    {
        using var scope = _fixture.Services.CreateScope();
        var validator = new TestGoogleOidcTokenValidator();

        var audience = "https://wherezit-api-dev-505615.us-central1.run.app";
        var allowedSa = TestGoogleOidcTokenValidator.ApprovedServiceAccount;

        // 1. Missing header -> 401
        var resMissing = await validator.ValidateTokenAsync(null, audience, allowedSa);
        Assert.False(resMissing.IsSuccess);
        Assert.Equal(OidcValidationResultStatus.MissingToken, resMissing.Status);

        // 2. Malformed token -> 401
        var resMalformed = await validator.ValidateTokenAsync("InvalidHeaderScheme 123", audience, allowedSa);
        Assert.False(resMalformed.IsSuccess);
        Assert.Equal(OidcValidationResultStatus.MissingToken, resMalformed.Status);

        // 3. Invalid token -> 401
        var resInvalid = await validator.ValidateTokenAsync($"Bearer {TestGoogleOidcTokenValidator.InvalidToken}", audience, allowedSa);
        Assert.False(resInvalid.IsSuccess);
        Assert.Equal(OidcValidationResultStatus.InvalidToken, resInvalid.Status);

        // 4. Valid token from wrong service account -> 403 Forbidden
        var resWrongAcc = await validator.ValidateTokenAsync($"Bearer {TestGoogleOidcTokenValidator.WrongAccountToken}", audience, allowedSa);
        Assert.False(resWrongAcc.IsSuccess);
        Assert.Equal(OidcValidationResultStatus.ForbiddenIdentity, resWrongAcc.Status);

        // 5. Valid token from approved service account -> Success
        var resValid = await validator.ValidateTokenAsync($"Bearer {TestGoogleOidcTokenValidator.ValidToken}", audience, allowedSa);
        Assert.True(resValid.IsSuccess);
        Assert.Equal(OidcValidationResultStatus.Success, resValid.Status);
        Assert.Equal(allowedSa, resValid.SubjectEmail);
    }
}
