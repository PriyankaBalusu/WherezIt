using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.Authentication;
using WherezIt.Application.Workspaces.Dtos;

namespace WherezIt.Application.Workspaces.Services;

public interface IWorkspaceService
{
    Task<List<WorkspaceResponseDto>> GetUserWorkspacesAsync(AuthenticatedIdentity identity, CancellationToken cancellationToken = default);
    Task<WorkspaceResponseDto> CreateWorkspaceAsync(AuthenticatedIdentity identity, CreateWorkspaceRequestDto request, CancellationToken cancellationToken = default);
    Task<WorkspaceResponseDto> RenameWorkspaceAsync(AuthenticatedIdentity identity, Guid workspaceId, string newName, CancellationToken cancellationToken = default);
    Task DeleteWorkspaceAsync(AuthenticatedIdentity identity, Guid workspaceId, CancellationToken cancellationToken = default);
}
