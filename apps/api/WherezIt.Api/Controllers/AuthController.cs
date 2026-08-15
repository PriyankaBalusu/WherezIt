using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WherezIt.Application.Authentication;
using WherezIt.Application.Users.Services;

namespace WherezIt.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IUserService _userService;

    public AuthController(IUserService userService)
    {
        _userService = userService;
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser(CancellationToken cancellationToken)
    {
        var uid = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                  ?? User.FindFirst("user_id")?.Value
                  ?? User.FindFirst("uid")?.Value;

        if (string.IsNullOrEmpty(uid))
        {
            return Unauthorized(new { error = "Firebase UID claim not found in authenticated principal." });
        }

        var email = User.FindFirst(ClaimTypes.Email)?.Value
                    ?? User.FindFirst("email")?.Value;

        var emailVerifiedStr = User.FindFirst("email_verified")?.Value;
        bool.TryParse(emailVerifiedStr, out bool emailVerified);

        var identity = new AuthenticatedIdentity(uid, email, emailVerified);
        var userDto = await _userService.SyncCurrentUserAsync(identity, cancellationToken);

        return Ok(userDto);
    }
}
