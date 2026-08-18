using System;
using System.IO;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using WherezIt.Application.Authentication;
using WherezIt.Application.Images.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
[Authorize]
public class ImagesController : ControllerBase
{
    private readonly IImageManagementService _imageService;

    public ImagesController(IImageManagementService imageService)
    {
        _imageService = imageService;
    }

    [HttpPost("api/v1/workspaces/{workspaceId}/containers/{containerId}/images")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadContainerImage(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        IFormFile file,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "An image file is required." });
        }

        try
        {
            using var stream = file.OpenReadStream();
            var response = await _imageService.UploadContainerImageAsync(
                identity,
                workspaceId,
                containerId,
                stream,
                file.ContentType,
                file.Length,
                cancellationToken);

            return CreatedAtAction(
                nameof(GetImage),
                new { workspaceId = response.WorkspaceId, imageId = response.Id },
                response);
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
        catch (InvalidOperationException ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = ex.Message });
        }
    }

    [HttpGet("api/v1/workspaces/{workspaceId}/images/{imageId}")]
    public async Task<IActionResult> GetImage(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid imageId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var result = await _imageService.GetImageAsync(identity, workspaceId, imageId, cancellationToken);
            if (result == null)
            {
                return NotFound(new { error = "Image not found." });
            }

            return File(result.Value.Stream, result.Value.ContentType);
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
