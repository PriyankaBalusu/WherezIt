using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using WherezIt.Application.ActivityHistory.Services;
using WherezIt.Application.Authentication;

namespace WherezIt.Api.Controllers;

[ApiController]
[Authorize]
public class ActivityHistoryController : ControllerBase
{
    private readonly IActivityHistoryService _historyService;

    public ActivityHistoryController(IActivityHistoryService historyService)
    {
        _historyService = historyService;
    }

    [HttpGet("api/v1/workspaces/{workspaceId}/containers/{containerId}/history")]
    [EnableRateLimiting("GeneralApiPolicy")]
    public async Task<IActionResult> GetContainerHistory(
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
            var history = await _historyService.GetContainerHistoryAsync(identity, workspaceId, containerId, cancellationToken);
            return Ok(history);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
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
