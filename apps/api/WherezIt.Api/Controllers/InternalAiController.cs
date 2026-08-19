using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using WherezIt.Application.AI.Services;
using WherezIt.Application.Authentication.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
public class InternalAiController : ControllerBase
{
    private readonly IAIJobProcessor _jobProcessor;
    private readonly IGoogleOidcTokenValidator _oidcValidator;
    private readonly IConfiguration _configuration;

    public InternalAiController(
        IAIJobProcessor jobProcessor,
        IGoogleOidcTokenValidator oidcValidator,
        IConfiguration configuration)
    {
        _jobProcessor = jobProcessor;
        _oidcValidator = oidcValidator;
        _configuration = configuration;
    }

    [HttpPost("api/v1/internal/ai/jobs/{jobId}/process")]
    public async Task<IActionResult> ProcessJob(
        [FromRoute] Guid jobId,
        CancellationToken cancellationToken = default)
    {
        var expectedAudience = _configuration["InternalTasks:Audience"] ?? "https://wherezit-api-dev-505615.us-central1.run.app";
        var allowedAccount = _configuration["InternalTasks:AllowedServiceAccount"] ?? "wherezit-cloudtasks-sa@wherezit-505615.iam.gserviceaccount.com";

        var authHeader = Request.Headers["Authorization"].ToString();
        var validationResult = await _oidcValidator.ValidateTokenAsync(authHeader, expectedAudience, allowedAccount, cancellationToken);

        if (!validationResult.IsSuccess)
        {
            if (validationResult.Status == OidcValidationResultStatus.ForbiddenIdentity)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { error = validationResult.ErrorMessage });
            }

            return StatusCode(StatusCodes.Status401Unauthorized, new { error = validationResult.ErrorMessage });
        }

        try
        {
            await _jobProcessor.ProcessJobAsync(jobId, cancellationToken);
            return Ok(new { message = "Job processing completed." });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new { error = "Internal processing error: " + ex.Message });
        }
    }
}
