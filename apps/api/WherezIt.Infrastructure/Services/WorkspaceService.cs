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
                m.Workspace.CreatedAt,
                m.Workspace.InventoryNamespaceId))
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

        // Resolve user's inventory namespaces
        var userNamespaceIds = await _dbContext.InventoryNamespaceMembers
            .Where(m => m.UserId == user.Id)
            .Select(m => m.InventoryNamespaceId)
            .ToListAsync(cancellationToken);

        Guid targetNamespaceId;
        var now = DateTimeOffset.UtcNow;

        if (userNamespaceIds.Count == 0)
        {
            // Case 0 inventories: create default "My Inventory"
            var newNamespace = new InventoryNamespace
            {
                Id = Guid.NewGuid(),
                Name = "My Inventory",
                CreatedAt = now,
                UpdatedAt = now
            };

            var nsMember = new InventoryNamespaceMember
            {
                InventoryNamespaceId = newNamespace.Id,
                UserId = user.Id,
                Role = WorkspaceRole.OWNER,
                CreatedAt = now
            };

            var nsCounter = new InventoryNamespaceBoxCounter
            {
                InventoryNamespaceId = newNamespace.Id,
                NextBoxNumber = 1
            };

            _dbContext.InventoryNamespaces.Add(newNamespace);
            _dbContext.InventoryNamespaceMembers.Add(nsMember);
            _dbContext.InventoryNamespaceBoxCounters.Add(nsCounter);

            targetNamespaceId = newNamespace.Id;
        }
        else if (userNamespaceIds.Count == 1)
        {
            if (request.InventoryNamespaceId.HasValue)
            {
                if (!userNamespaceIds.Contains(request.InventoryNamespaceId.Value))
                {
                    throw new UnauthorizedAccessException("User is not a member of the requested inventory.");
                }
                targetNamespaceId = request.InventoryNamespaceId.Value;
            }
            else
            {
                targetNamespaceId = userNamespaceIds[0];
            }
        }
        else // 2+ inventories
        {
            if (!request.InventoryNamespaceId.HasValue)
            {
                throw new ArgumentException("InventoryNamespaceId is required because you belong to multiple inventories.", nameof(request));
            }

            if (!userNamespaceIds.Contains(request.InventoryNamespaceId.Value))
            {
                throw new UnauthorizedAccessException("User is not a member of the requested inventory.");
            }
            targetNamespaceId = request.InventoryNamespaceId.Value;
        }

        var workspace = new Workspace
        {
            Id = Guid.NewGuid(),
            Name = trimmedName,
            InventoryNamespaceId = targetNamespaceId,
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
            workspace.CreatedAt,
            workspace.InventoryNamespaceId);
    }
}
