using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WherezIt.Application.AI.Services;
using WherezIt.Application.Authentication;

namespace WherezIt.Api.Controllers;

[ApiController]
[Route("api/v1/workspaces/{workspaceId}/captures")]
[Authorize]
public class AICapturesController : ControllerBase
{
    private readonly IAICaptureReviewService _reviewService;
    private readonly IAICaptureConfirmationService _confirmationService;

    public AICapturesController(
        IAICaptureReviewService reviewService,
        IAICaptureConfirmationService confirmationService)
    {
        _reviewService = reviewService;
        _confirmationService = confirmationService;
    }

    [HttpGet("{captureId}/review")]
    public async Task<IActionResult> GetCaptureReview(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid captureId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null)
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        try
        {
            var review = await _reviewService.GetCaptureReviewAsync(identity, workspaceId, captureId, cancellationToken);
            return Ok(review);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{captureId}/confirm")]
    public async Task<IActionResult> ConfirmCapture(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid captureId,
        [FromBody] WherezIt.Application.AI.Dtos.ConfirmCaptureRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null)
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        try
        {
            var response = await _confirmationService.ConfirmCaptureAsync(identity, workspaceId, captureId, request, cancellationToken);
            return Ok(response);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return StatusCode(Microsoft.AspNetCore.Http.StatusCodes.Status409Conflict, new { error = ex.Message });
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
