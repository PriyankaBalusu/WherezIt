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

    [HttpGet("api/v1/workspaces/{workspaceId}/containers/{containerId}/images")]
    public async Task<IActionResult> GetContainerImages(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var images = await _imageService.GetContainerReferenceImagesAsync(identity, workspaceId, containerId, cancellationToken);
            return Ok(images);
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

    [HttpDelete("api/v1/workspaces/{workspaceId}/containers/{containerId}/images/{imageId}")]
    public async Task<IActionResult> DeleteContainerImage(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        [FromRoute] Guid imageId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            await _imageService.DeleteContainerReferenceImageAsync(identity, workspaceId, containerId, imageId, cancellationToken);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPost("api/v1/workspaces/{workspaceId}/containers/{containerId}/physical-label-image")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadContainerPhysicalLabelImage(
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
            var response = await _imageService.UploadContainerPhysicalLabelImageAsync(
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

    [HttpGet("api/v1/workspaces/{workspaceId}/containers/{containerId}/physical-label-image")]
    public async Task<IActionResult> GetContainerPhysicalLabelImage(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var image = await _imageService.GetContainerPhysicalLabelImageAsync(identity, workspaceId, containerId, cancellationToken);
            if (image == null) return NotFound(new { error = "No physical label image found for this container." });
            return Ok(image);
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

    [HttpDelete("api/v1/workspaces/{workspaceId}/containers/{containerId}/physical-label-image")]
    public async Task<IActionResult> DeleteContainerPhysicalLabelImage(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            await _imageService.DeleteContainerPhysicalLabelImageAsync(identity, workspaceId, containerId, cancellationToken);
            return NoContent();
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

    [HttpDelete("api/v1/workspaces/{workspaceId}/containers/{containerId}/existing-label")]
    public async Task<IActionResult> DeleteContainerExistingLabel(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            await _imageService.DeleteContainerExistingLabelAsync(identity, workspaceId, containerId, cancellationToken);
            return NoContent();
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

    [HttpPost("api/v1/workspaces/{workspaceId}/containers/{containerId}/physical-label-image/ocr")]
    public async Task<IActionResult> ExtractContainerPhysicalLabelOcrText(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var detectedText = await _imageService.ExtractContainerPhysicalLabelOcrTextAsync(
                identity,
                workspaceId,
                containerId,
                cancellationToken);

            return Ok(new { detectedText });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception)
        {
            return Ok(new { detectedText = (string?)null });
        }
    }

    [HttpPost("api/v1/workspaces/{workspaceId}/items/{itemId}/images")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> UploadItemImage(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid itemId,
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
            var response = await _imageService.UploadItemImageAsync(
                identity,
                workspaceId,
                itemId,
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
    }

    [HttpGet("api/v1/workspaces/{workspaceId}/items/{itemId}/images")]
    public async Task<IActionResult> GetItemImages(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid itemId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var images = await _imageService.GetItemImagesAsync(identity, workspaceId, itemId, cancellationToken);
            return Ok(images);
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

    [HttpDelete("api/v1/workspaces/{workspaceId}/items/{itemId}/images/{imageId}")]
    public async Task<IActionResult> DeleteItemImage(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid itemId,
        [FromRoute] Guid imageId,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            await _imageService.DeleteItemImageAsync(identity, workspaceId, itemId, imageId, cancellationToken);
            return NoContent();
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
