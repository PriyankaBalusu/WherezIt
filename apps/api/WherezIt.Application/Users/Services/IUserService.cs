using WherezIt.Application.Authentication;
using WherezIt.Application.Users.Dtos;

namespace WherezIt.Application.Users.Services;

public interface IUserService
{
    Task<UserResponseDto> SyncCurrentUserAsync(AuthenticatedIdentity identity, CancellationToken cancellationToken = default);
}
