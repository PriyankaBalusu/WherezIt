using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.Users.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class WorkspaceAuthorizationService : IWorkspaceAuthorizationService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IUserService _userService;

    public WorkspaceAuthorizationService(WherezItDbContext dbContext, IUserService userService)
    {
        _dbContext = dbContext;
        _userService = userService;
    }

    public async Task<bool> IsWorkspaceMemberAsync(Guid userId, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        if (userId == Guid.Empty || workspaceId == Guid.Empty)
        {
            return false;
        }

        return await _dbContext.WorkspaceMembers
            .AsNoTracking()
            .AnyAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId, cancellationToken);
    }

    public async Task RequireWorkspaceMembershipAsync(Guid userId, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        var isMember = await IsWorkspaceMemberAsync(userId, workspaceId, cancellationToken);
        if (!isMember)
        {
            throw new UnauthorizedAccessException($"User '{userId}' is not a member of workspace '{workspaceId}'.");
        }
    }

    public async Task<bool> IsWorkspaceMemberAsync(AuthenticatedIdentity identity, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        var user = await _userService.SyncCurrentUserAsync(identity, cancellationToken);
        return await IsWorkspaceMemberAsync(user.Id, workspaceId, cancellationToken);
    }

    public async Task RequireWorkspaceMembershipAsync(AuthenticatedIdentity identity, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        var user = await _userService.SyncCurrentUserAsync(identity, cancellationToken);
        await RequireWorkspaceMembershipAsync(user.Id, workspaceId, cancellationToken);
    }
}
