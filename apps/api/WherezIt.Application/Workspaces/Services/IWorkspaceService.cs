using WherezIt.Application.Authentication;
using WherezIt.Application.Workspaces.Dtos;

namespace WherezIt.Application.Workspaces.Services;

public interface IWorkspaceService
{
    Task<List<WorkspaceResponseDto>> GetUserWorkspacesAsync(AuthenticatedIdentity identity, CancellationToken cancellationToken = default);
    Task<WorkspaceResponseDto> CreateWorkspaceAsync(AuthenticatedIdentity identity, CreateWorkspaceRequestDto request, CancellationToken cancellationToken = default);
}
