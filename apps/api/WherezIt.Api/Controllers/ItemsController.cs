using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WherezIt.Application.Authentication;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
[Authorize]
public class ItemsController : ControllerBase
{
    private readonly IItemService _itemService;

    public ItemsController(IItemService itemService)
    {
        _itemService = itemService;
    }

    [HttpGet("api/v1/workspaces/{workspaceId}/containers/{containerId}/items")]
    public async Task<IActionResult> GetItemsByContainer(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        [FromQuery] bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var items = await _itemService.GetItemsByContainerAsync(identity, workspaceId, containerId, includeArchived, cancellationToken);
            return Ok(items);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpGet("api/v1/workspaces/{workspaceId}/items/{itemId}")]
    public async Task<IActionResult> GetItem(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid itemId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var item = await _itemService.GetItemAsync(identity, workspaceId, itemId, cancellationToken);
            return Ok(item);
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

    [HttpPost("api/v1/workspaces/{workspaceId}/containers/{containerId}/items")]
    public async Task<IActionResult> CreateItem(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        [FromBody] CreateItemRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var item = await _itemService.CreateItemAsync(identity, workspaceId, containerId, request, cancellationToken);
            return Created($"/api/v1/workspaces/{workspaceId}/items/{item.Id}", item);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
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

    [HttpPatch("api/v1/workspaces/{workspaceId}/items/{itemId}")]
    public async Task<IActionResult> UpdateItem(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid itemId,
        [FromBody] UpdateItemRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var item = await _itemService.UpdateItemAsync(identity, workspaceId, itemId, request, cancellationToken);
            return Ok(item);
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

    [HttpPost("api/v1/workspaces/{workspaceId}/items/{itemId}/archive")]
    public async Task<IActionResult> ArchiveItem(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid itemId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var item = await _itemService.ArchiveItemAsync(identity, workspaceId, itemId, cancellationToken);
            return Ok(item);
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

    [HttpPost("api/v1/workspaces/{workspaceId}/items/{itemId}/restore")]
    public async Task<IActionResult> RestoreItem(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid itemId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var item = await _itemService.RestoreItemAsync(identity, workspaceId, itemId, cancellationToken);
            return Ok(item);
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
