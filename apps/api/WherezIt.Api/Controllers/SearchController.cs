using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WherezIt.Application.Authentication;
using WherezIt.Application.Search.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
[Route("api/v1")]
[Authorize]
public class SearchController : ControllerBase
{
    private readonly IWorkspaceSearchService _searchService;

    public SearchController(IWorkspaceSearchService searchService)
    {
        _searchService = searchService;
    }

    /// <summary>
    /// Global Search across all Storage Spaces authorized for the current user.
    /// GET /api/v1/search?q={query}
    /// </summary>
    [HttpGet("search")]
    public async Task<IActionResult> GlobalSearch(
        [FromQuery] string? q,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null)
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        try
        {
            var results = await _searchService.SearchAuthorizedWorkspacesAsync(identity, q ?? string.Empty, cancellationToken);
            return Ok(results);
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

    /// <summary>
    /// Scoped Search for a specific Storage Space.
    /// GET /api/v1/workspaces/{workspaceId}/search?q={query}
    /// </summary>
    [HttpGet("workspaces/{workspaceId}/search")]
    public async Task<IActionResult> Search(
        [FromRoute] Guid workspaceId,
        [FromQuery] string? q,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null)
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        try
        {
            var results = await _searchService.SearchWorkspaceAsync(identity, workspaceId, q ?? string.Empty, cancellationToken);
            return Ok(results);
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
