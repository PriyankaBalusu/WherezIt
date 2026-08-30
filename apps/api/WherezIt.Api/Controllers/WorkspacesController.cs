using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WherezIt.Application.Authentication;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
[Route("api/v1/workspaces")]
[Authorize]
public class WorkspacesController : ControllerBase
{
    private readonly IWorkspaceService _workspaceService;

    public WorkspacesController(IWorkspaceService workspaceService)
    {
        _workspaceService = workspaceService;
    }

    [HttpGet]
    public async Task<IActionResult> GetUserWorkspaces(CancellationToken cancellationToken)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null)
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        var workspaces = await _workspaceService.GetUserWorkspacesAsync(identity, cancellationToken);
        return Ok(workspaces);
    }

    [HttpPost]
    public async Task<IActionResult> CreateWorkspace(
        [FromBody] CreateWorkspaceRequestDto request,
        CancellationToken cancellationToken)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null)
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        try
        {
            var workspace = await _workspaceService.CreateWorkspaceAsync(identity, request, cancellationToken);
            return Created($"/api/v1/workspaces/{workspace.Id}", workspace);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPut("{workspaceId}")]
    public async Task<IActionResult> RenameWorkspace(
        [FromRoute] Guid workspaceId,
        [FromBody] CreateWorkspaceRequestDto request,
        CancellationToken cancellationToken)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var workspace = await _workspaceService.RenameWorkspaceAsync(identity, workspaceId, request.Name, cancellationToken);
            return Ok(workspace);
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

    [HttpDelete("{workspaceId}")]
    public async Task<IActionResult> DeleteWorkspace(
        [FromRoute] Guid workspaceId,
        CancellationToken cancellationToken)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            await _workspaceService.DeleteWorkspaceAsync(identity, workspaceId, cancellationToken);
            return NoContent();
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

        if (string.IsNullOrEmpty(uid))
        {
            return null;
        }

        var email = User.FindFirst(ClaimTypes.Email)?.Value
                    ?? User.FindFirst("email")?.Value;

        var emailVerifiedStr = User.FindFirst("email_verified")?.Value;
        bool.TryParse(emailVerifiedStr, out bool emailVerified);

        return new AuthenticatedIdentity(uid, email, emailVerified);
    }
}
