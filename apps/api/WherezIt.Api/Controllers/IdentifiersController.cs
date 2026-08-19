using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WherezIt.Application.Authentication;
using WherezIt.Application.Identifiers.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
[Authorize]
public class IdentifiersController : ControllerBase
{
    private readonly IIdentifierService _identifierService;

    public IdentifiersController(IIdentifierService identifierService)
    {
        _identifierService = identifierService;
    }

    [HttpPost("api/v1/workspaces/{workspaceId}/containers/{containerId}/identifiers/qr")]
    [EnableRateLimiting("GeneralApiPolicy")]
    public async Task<IActionResult> GetOrCreateQrIdentifier(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null)
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        try
        {
            var identifier = await _identifierService.GetOrCreateQrIdentifierAsync(identity, workspaceId, containerId, cancellationToken);
            return Ok(new
            {
                identifierId = identifier.Id,
                type = identifier.Type,
                value = identifier.Value,
                createdAt = identifier.CreatedAt
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("api/v1/workspaces/{workspaceId}/containers/{containerId}/identifiers/barcode")]
    [EnableRateLimiting("GeneralApiPolicy")]
    public async Task<IActionResult> GetOrCreateBarcodeIdentifier(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null)
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        try
        {
            var identifier = await _identifierService.GetOrCreateIdentifierAsync(identity, workspaceId, containerId, "BARCODE", cancellationToken);
            return Ok(new
            {
                identifierId = identifier.Id,
                type = identifier.Type,
                value = identifier.Value,
                createdAt = identifier.CreatedAt
            });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("api/v1/identifiers/resolve")]
    [EnableRateLimiting("IdentifierResolvePolicy")]
    public async Task<IActionResult> ResolveIdentifier(
        [FromQuery] string value,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null)
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        try
        {
            var resolved = await _identifierService.ResolveAuthorizedContainerAsync(identity, value, cancellationToken);
            return Ok(resolved);
        }
        catch (KeyNotFoundException)
        {
            // Sanitized 404 equivalent response for invalid OR unauthorized requests
            return NotFound(new { error = "Container not found or unavailable." });
        }
        catch (UnauthorizedAccessException)
        {
            // Equivalence: return 404 to avoid leaking workspace existence to nonmembers
            return NotFound(new { error = "Container not found or unavailable." });
        }
    }

    private AuthenticatedIdentity? GetAuthenticatedIdentity()
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("user_id")?.Value
                  ?? User.FindFirst("uid")?.Value;

        if (string.IsNullOrEmpty(uid)) return null;

        var email = User.FindFirst(ClaimTypes.Email)?.Value ?? User.FindFirst("email")?.Value;
        var emailVerifiedStr = User.FindFirst("email_verified")?.Value;
        bool.TryParse(emailVerifiedStr, out bool emailVerified);

        return new AuthenticatedIdentity(uid, email, emailVerified);
    }
}
