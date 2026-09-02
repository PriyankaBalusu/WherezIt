using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
[Route("api/v1/inventory-namespaces/{inventoryNamespaceId}/containers/{containerId}/transfer")]
[Authorize]
public class ContainerTransfersController : ControllerBase
{
    private readonly IContainerTransferService _transferService;

    public ContainerTransfersController(IContainerTransferService transferService)
    {
        _transferService = transferService;
    }

    [HttpPost]
    public async Task<IActionResult> TransferContainer(
        [FromRoute] Guid inventoryNamespaceId,
        [FromRoute] Guid containerId,
        [FromBody] TransferContainerRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var identity = GetAuthenticatedIdentity();
        if (identity == null) return Unauthorized();

        try
        {
            var result = await _transferService.TransferContainerAsync(
                identity,
                inventoryNamespaceId,
                containerId,
                request,
                cancellationToken);

            return Ok(result);
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (DbUpdateException ex)
        {
            return BadRequest(new { error = ex.InnerException?.Message ?? ex.Message });
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
