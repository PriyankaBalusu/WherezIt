using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
[Route("api/v1/workspaces/{workspaceId}/containers")]
[Authorize]
public class ContainersController : ControllerBase
{
    private readonly IContainerService _containerService;

    public ContainersController(IContainerService containerService)
    {
        _containerService = containerService;
    }

    [HttpGet]
    public async Task<IActionResult> GetContainers(
        [FromRoute] Guid workspaceId,
        [FromQuery] Guid? storageNodeId,
        [FromQuery] bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var containers = await _containerService.GetContainersAsync(identity, workspaceId, storageNodeId, includeArchived, cancellationToken);
            return Ok(containers);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpGet("{containerId}")]
    public async Task<IActionResult> GetContainer(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var container = await _containerService.GetContainerAsync(identity, workspaceId, containerId, cancellationToken);
            return Ok(container);
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

    [HttpPost]
    public async Task<IActionResult> CreateContainer(
        [FromRoute] Guid workspaceId,
        [FromBody] CreateContainerRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var container = await _containerService.CreateContainerAsync(identity, workspaceId, request, cancellationToken);
            return Created($"/api/v1/workspaces/{workspaceId}/containers/{container.Id}", container);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPatch("{containerId}")]
    public async Task<IActionResult> UpdateContainer(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        [FromBody] UpdateContainerRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var container = await _containerService.UpdateContainerAsync(identity, workspaceId, containerId, request, cancellationToken);
            return Ok(container);
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

    [HttpPost("{containerId}/archive")]
    public async Task<IActionResult> ArchiveContainer(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var container = await _containerService.ArchiveContainerAsync(identity, workspaceId, containerId, cancellationToken);
            return Ok(container);
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

    [HttpPost("{containerId}/restore")]
    public async Task<IActionResult> RestoreContainer(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var container = await _containerService.RestoreContainerAsync(identity, workspaceId, containerId, cancellationToken);
            return Ok(container);
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
