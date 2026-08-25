using System;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
    private readonly WherezIt.Application.Images.Services.IImageManagementService _imageService;
    private readonly WherezIt.Application.AI.Services.IAIJobProcessor _jobProcessor;
    private readonly WherezIt.Application.Workspaces.Services.IWorkspaceAuthorizationService _authService;
    private readonly WherezIt.Infrastructure.Persistence.WherezItDbContext _dbContext;

    public AICapturesController(
        IAICaptureReviewService reviewService,
        IAICaptureConfirmationService confirmationService,
        WherezIt.Application.Images.Services.IImageManagementService imageService,
        WherezIt.Application.AI.Services.IAIJobProcessor jobProcessor,
        WherezIt.Application.Workspaces.Services.IWorkspaceAuthorizationService authService,
        WherezIt.Infrastructure.Persistence.WherezItDbContext dbContext)
    {
        _reviewService = reviewService;
        _confirmationService = confirmationService;
        _imageService = imageService;
        _jobProcessor = jobProcessor;
        _authService = authService;
        _dbContext = dbContext;
    }

    [HttpPost("/api/v1/workspaces/{workspaceId}/containers/{containerId}/captures")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> CreateCapture(
        [FromRoute] Guid workspaceId,
        [FromRoute] Guid containerId,
        IFormFile file,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null)
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { error = "An image file is required." });
        }

        try
        {
            await _authService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

            var container = await Microsoft.EntityFrameworkCore.EntityFrameworkQueryableExtensions.FirstOrDefaultAsync(
                _dbContext.Containers, c => c.Id == containerId && c.WorkspaceId == workspaceId, cancellationToken);

            if (container == null)
            {
                return NotFound(new { error = "Container not found in this workspace." });
            }

            using var stream = file.OpenReadStream();
            var imageResponse = await _imageService.UploadContainerImageAsync(
                identity, workspaceId, containerId, stream, file.ContentType, file.Length, cancellationToken);

            var captureId = Guid.NewGuid();
            var now = DateTimeOffset.UtcNow;

            var capture = new WherezIt.Domain.Entities.InventoryCapture
            {
                Id = captureId,
                WorkspaceId = workspaceId,
                ContainerId = containerId,
                ImageAssetId = imageResponse.Id,
                Status = "PROCESSING",
                CreatedAt = now,
                UpdatedAt = now,
            };

            var jobId = Guid.NewGuid();
            var job = new WherezIt.Domain.Entities.AIProcessingJob
            {
                Id = jobId,
                WorkspaceId = workspaceId,
                CaptureId = captureId,
                Status = "QUEUED",
                AttemptCount = 0,
                CreatedAt = now,
                UpdatedAt = now,
            };

            _dbContext.InventoryCaptures.Add(capture);
            _dbContext.AIProcessingJobs.Add(job);
            await _dbContext.SaveChangesAsync(cancellationToken);

            // Execute local AI job processing inline
            await _jobProcessor.ProcessJobAsync(jobId, cancellationToken);

            return Created($"/api/v1/workspaces/{workspaceId}/captures/{captureId}/review", new
            {
                captureId = captureId,
                workspaceId = workspaceId,
                containerId = containerId,
                status = "REVIEW_REQUIRED",
            });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "AI capture failed: " + ex.Message });
        }
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
    [EnableRateLimiting("AiEndpointPolicy")]
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
