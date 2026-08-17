using WherezIt.Application.Authentication;

namespace WherezIt.Application.Workspaces.Services;

public interface IWorkspaceAuthorizationService
{
    Task<bool> IsWorkspaceMemberAsync(Guid userId, Guid workspaceId, CancellationToken cancellationToken = default);
    Task RequireWorkspaceMembershipAsync(Guid userId, Guid workspaceId, CancellationToken cancellationToken = default);
    Task<bool> IsWorkspaceMemberAsync(AuthenticatedIdentity identity, Guid workspaceId, CancellationToken cancellationToken = default);
    Task RequireWorkspaceMembershipAsync(AuthenticatedIdentity identity, Guid workspaceId, CancellationToken cancellationToken = default);
}
