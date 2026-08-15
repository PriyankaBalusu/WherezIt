using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.Users.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Domain.Enums;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class WorkspaceService : IWorkspaceService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IUserService _userService;

    public WorkspaceService(WherezItDbContext dbContext, IUserService userService)
    {
        _dbContext = dbContext;
        _userService = userService;
    }

    public async Task<List<WorkspaceResponseDto>> GetUserWorkspacesAsync(
        AuthenticatedIdentity identity,
        CancellationToken cancellationToken = default)
    {
        var user = await _userService.SyncCurrentUserAsync(identity, cancellationToken);

        var members = await _dbContext.WorkspaceMembers
            .AsNoTracking()
            .Where(m => m.UserId == user.Id)
            .Include(m => m.Workspace)
            .OrderByDescending(m => m.CreatedAt)
            .ToListAsync(cancellationToken);

        return members
            .Select(m => new WorkspaceResponseDto(
                m.Workspace.Id,
                m.Workspace.Name,
                m.Role.ToString(),
                m.Workspace.CreatedAt))
            .ToList();
    }

    public async Task<WorkspaceResponseDto> CreateWorkspaceAsync(
        AuthenticatedIdentity identity,
        CreateWorkspaceRequestDto request,
        CancellationToken cancellationToken = default)
    {
        var user = await _userService.SyncCurrentUserAsync(identity, cancellationToken);

        var trimmedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            throw new ArgumentException("Workspace name cannot be empty.", nameof(request));
        }

        if (trimmedName.Length > 100)
        {
            throw new ArgumentException("Workspace name cannot exceed 100 characters.", nameof(request));
        }

        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var workspace = new Workspace
        {
            Id = Guid.NewGuid(),
            Name = trimmedName,
            CreatedAt = now,
            UpdatedAt = now
        };

        var member = new WorkspaceMember
        {
            WorkspaceId = workspace.Id,
            UserId = user.Id,
            Role = WorkspaceRole.OWNER,
            CreatedAt = now
        };

        _dbContext.Workspaces.Add(workspace);
        _dbContext.WorkspaceMembers.Add(member);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new WorkspaceResponseDto(
            workspace.Id,
            workspace.Name,
            member.Role.ToString(),
            workspace.CreatedAt);
    }
}
