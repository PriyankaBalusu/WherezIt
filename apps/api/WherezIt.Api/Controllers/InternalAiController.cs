using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using WherezIt.Application.AI.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
public class InternalAiController : ControllerBase
{
    private readonly IAIJobProcessor _jobProcessor;

    public InternalAiController(IAIJobProcessor jobProcessor)
    {
        _jobProcessor = jobProcessor;
    }

    [HttpPost("api/v1/internal/ai/jobs/{jobId}/process")]
    public async Task<IActionResult> ProcessJob(
        [FromRoute] Guid jobId,
        CancellationToken cancellationToken = default)
    {
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
