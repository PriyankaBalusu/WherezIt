using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
[Route("api/v1/workspaces/{workspaceId}/locations")]
[Authorize]
public class StorageLocationsController : ControllerBase
{
    private readonly IStorageLocationService _locationService;
    private readonly ILocationMoveService? _moveService;
    private readonly IBreadcrumbService? _breadcrumbService;

    public StorageLocationsController(
        IStorageLocationService locationService,
        ILocationMoveService? moveService = null,
        IBreadcrumbService? breadcrumbService = null)
    {
        _locationService = locationService;
        _moveService = moveService;
        _breadcrumbService = breadcrumbService;
    }

    [HttpGet]
    public async Task<IActionResult> GetLocations([FromRoute] Guid workspaceId, CancellationToken cancellationToken)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var locations = await _locationService.GetLocationsAsync(identity, workspaceId, cancellationToken);
            return Ok(locations);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpGet("{locationId}")]
    public async Task<IActionResult> GetLocation(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid locationId,
        CancellationToken cancellationToken)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var location = await _locationService.GetLocationAsync(identity, workspaceId, locationId, cancellationToken);
            return Ok(location);
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
    public async Task<IActionResult> CreateLocation(
        [FromRoute] Guid workspaceId,
        [FromBody] CreateStorageLocationRequestDto request,
        CancellationToken cancellationToken)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var location = await _locationService.CreateLocationAsync(identity, workspaceId, request, cancellationToken);
            return Created($"/api/v1/workspaces/{workspaceId}/locations/{location.Id}", location);
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

    [HttpPatch("{locationId}")]
    public async Task<IActionResult> RenameLocation(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid locationId,
        [FromBody] RenameStorageLocationRequestDto request,
        CancellationToken cancellationToken)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var location = await _locationService.RenameLocationAsync(identity, workspaceId, locationId, request, cancellationToken);
            return Ok(location);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
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

    [HttpDelete("{locationId}")]
    public async Task<IActionResult> DeleteLocation(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid locationId,
        CancellationToken cancellationToken)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            await _locationService.DeleteLocationAsync(identity, workspaceId, locationId, cancellationToken);
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
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

    [HttpPost("{locationId}/move")]
    public async Task<IActionResult> MoveLocation(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid locationId,
        [FromBody] MoveStorageLocationRequestDto request,
        CancellationToken cancellationToken)
    {
        if (_moveService == null)
        {
            return StatusCode(500, new { error = "Location move service is not registered." });
        }

        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var location = await _moveService.MoveLocationAsync(identity, workspaceId, locationId, request, cancellationToken);
            return Ok(location);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
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

    [HttpGet("{locationId}/breadcrumb")]
    public async Task<IActionResult> GetBreadcrumb(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid locationId,
        CancellationToken cancellationToken)
    {
        if (_breadcrumbService == null)
        {
            return StatusCode(500, new { error = "Breadcrumb service is not registered." });
        }

        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var breadcrumb = await _breadcrumbService.GetBreadcrumbAsync(identity, workspaceId, locationId, cancellationToken);
            return Ok(breadcrumb);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
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
