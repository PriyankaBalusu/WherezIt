using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
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

        var workspaceIds = members.Select(m => m.WorkspaceId).ToList();

        var memberCounts = await _dbContext.WorkspaceMembers
            .AsNoTracking()
            .Where(m => workspaceIds.Contains(m.WorkspaceId))
            .GroupBy(m => m.WorkspaceId)
            .Select(g => new
            {
                WorkspaceId = g.Key,
                TotalCount = g.Count(),
                OwnerCount = g.Count(m => m.Role == WorkspaceRole.OWNER)
            })
            .ToDictionaryAsync(g => g.WorkspaceId, cancellationToken);

        return members
            .Select(m =>
            {
                var total = memberCounts.TryGetValue(m.Workspace.Id, out var c) ? c.TotalCount : 1;
                var owners = memberCounts.TryGetValue(m.Workspace.Id, out var c2) ? c2.OwnerCount : 1;

                return new WorkspaceResponseDto(
                    m.Workspace.Id,
                    m.Workspace.Name,
                    m.Role.ToString(),
                    m.Workspace.CreatedAt,
                    m.Workspace.InventoryNamespaceId,
                    total,
                    owners);
            })
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

        var userNamespaceIds = await _dbContext.InventoryNamespaceMembers
            .Where(m => m.UserId == user.Id)
            .Select(m => m.InventoryNamespaceId)
            .ToListAsync(cancellationToken);

        Guid targetNamespaceId;
        var now = DateTimeOffset.UtcNow;

        if (userNamespaceIds.Count == 0)
        {
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
        else
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

        var creationAudit = new WorkspaceAudit
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspace.Id,
            WorkspaceName = workspace.Name,
            InventoryNamespaceId = workspace.InventoryNamespaceId,
            EventType = "WORKSPACE_CREATED",
            ActorUserId = user.Id.ToString(),
            AllowedUserIds = user.Id.ToString(),
            OccurredAt = now
        };

        _dbContext.Workspaces.Add(workspace);
        _dbContext.WorkspaceMembers.Add(member);
        _dbContext.WorkspaceAudits.Add(creationAudit);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return new WorkspaceResponseDto(
            workspace.Id,
            workspace.Name,
            member.Role.ToString(),
            workspace.CreatedAt,
            workspace.InventoryNamespaceId);
    }

    public async Task<WorkspaceResponseDto> RenameWorkspaceAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        string newName,
        CancellationToken cancellationToken = default)
    {
        var user = await _userService.SyncCurrentUserAsync(identity, cancellationToken);

        var member = await _dbContext.WorkspaceMembers
            .Include(m => m.Workspace)
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == user.Id, cancellationToken);

        if (member == null)
        {
            throw new UnauthorizedAccessException("User is not a member of this Storage Space.");
        }

        var trimmed = newName?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            throw new ArgumentException("Storage space name cannot be empty.");
        }

        if (trimmed.Length > 100)
        {
            throw new ArgumentException("Storage space name must be 100 characters or fewer.");
        }

        var previousName = member.Workspace.Name;

        if (previousName == trimmed)
        {
            return new WorkspaceResponseDto(
                member.Workspace.Id,
                member.Workspace.Name,
                member.Role.ToString(),
                member.Workspace.CreatedAt,
                member.Workspace.InventoryNamespaceId);
        }

        member.Workspace.Name = trimmed;
        member.Workspace.UpdatedAt = DateTimeOffset.UtcNow;

        var memberUserIds = await _dbContext.WorkspaceMembers
            .Where(m => m.WorkspaceId == workspaceId)
            .Select(m => m.UserId.ToString())
            .ToListAsync(cancellationToken);

        if (!memberUserIds.Contains(user.Id.ToString()))
        {
            memberUserIds.Add(user.Id.ToString());
        }

        var renameAudit = new WorkspaceAudit
        {
            Id = Guid.NewGuid(),
            WorkspaceId = member.Workspace.Id,
            WorkspaceName = trimmed,
            InventoryNamespaceId = member.Workspace.InventoryNamespaceId,
            EventType = "WORKSPACE_RENAMED",
            ActorUserId = user.Id.ToString(),
            AllowedUserIds = string.Join(",", memberUserIds),
            OccurredAt = DateTimeOffset.UtcNow,
            DetailsJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                previousWorkspaceName = previousName,
                newWorkspaceName = trimmed
            })
        };

        _dbContext.WorkspaceAudits.Add(renameAudit);

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new WorkspaceResponseDto(
            member.Workspace.Id,
            member.Workspace.Name,
            member.Role.ToString(),
            member.Workspace.CreatedAt,
            member.Workspace.InventoryNamespaceId);
    }

    public async Task DeleteWorkspaceAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        CancellationToken cancellationToken = default)
    {
        var user = await _userService.SyncCurrentUserAsync(identity, cancellationToken);

        var member = await _dbContext.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == user.Id, cancellationToken);

        if (member == null)
        {
            throw new UnauthorizedAccessException("User is not authorized to access this Storage Space.");
        }

        if (member.Role != WorkspaceRole.OWNER)
        {
            throw new UnauthorizedAccessException("Only workspace owners can permanently delete a Storage Space.");
        }

        var workspace = await _dbContext.Workspaces.FindAsync(new object[] { workspaceId }, cancellationToken);
        if (workspace == null) return;

        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;

        // Capture all current member user IDs for durable audit access authorization
        var memberUserIds = await _dbContext.WorkspaceMembers
            .Where(m => m.WorkspaceId == workspaceId)
            .Select(m => m.UserId.ToString())
            .ToListAsync(cancellationToken);

        if (!memberUserIds.Contains(user.Id.ToString()))
        {
            memberUserIds.Add(user.Id.ToString());
        }

        var allowedUserIdsStr = string.Join(",", memberUserIds);

        // Update all historical audit records for this workspace so all final members can view the full timeline after deletion
        var existingAudits = await _dbContext.WorkspaceAudits
            .Where(a => a.WorkspaceId == workspaceId)
            .ToListAsync(cancellationToken);

        foreach (var audit in existingAudits)
        {
            var allowedList = (audit.AllowedUserIds ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
            foreach (var uid in memberUserIds)
            {
                if (!allowedList.Contains(uid))
                {
                    allowedList.Add(uid);
                }
            }
            audit.AllowedUserIds = string.Join(",", allowedList);
        }

        // Count impacted entities for durable audit metadata
        var locationCount = await _dbContext.StorageNodes.CountAsync(n => n.WorkspaceId == workspaceId, cancellationToken);
        var boxCount = await _dbContext.Containers.CountAsync(c => c.WorkspaceId == workspaceId, cancellationToken);
        var itemCount = await _dbContext.Items.CountAsync(i => i.WorkspaceId == workspaceId, cancellationToken);

        var detailsJson = $"{{\"locationsCount\":{locationCount},\"boxesCount\":{boxCount},\"itemsCount\":{itemCount}}}";

        var deletionAudit = new WorkspaceAudit
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspace.Id,
            WorkspaceName = workspace.Name,
            InventoryNamespaceId = workspace.InventoryNamespaceId,
            EventType = "WORKSPACE_DELETED",
            ActorUserId = user.Id.ToString(),
            AllowedUserIds = allowedUserIdsStr,
            OccurredAt = now,
            DetailsJson = detailsJson
        };

        _dbContext.WorkspaceAudits.Add(deletionAudit);

        // Cleanly remove workspace-dependent entities strictly in child-to-parent dependency order to satisfy RESTRICT FK constraints
        var suggestions = await _dbContext.Set<DetectionSuggestion>().Where(s => s.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        _dbContext.Set<DetectionSuggestion>().RemoveRange(suggestions);

        var jobs = await _dbContext.Set<AIProcessingJob>().Where(j => j.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        _dbContext.Set<AIProcessingJob>().RemoveRange(jobs);

        var captures = await _dbContext.InventoryCaptures.Where(c => c.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        _dbContext.InventoryCaptures.RemoveRange(captures);

        var images = await _dbContext.ImageAssets.Where(i => i.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        _dbContext.ImageAssets.RemoveRange(images);

        var histories = await _dbContext.ActivityHistories.Where(a => a.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        _dbContext.ActivityHistories.RemoveRange(histories);

        var identifiers = await _dbContext.Identifiers.Where(id => id.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        _dbContext.Identifiers.RemoveRange(identifiers);

        var items = await _dbContext.Items.Where(i => i.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        _dbContext.Items.RemoveRange(items);

        var containers = await _dbContext.Containers.Where(c => c.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        _dbContext.Containers.RemoveRange(containers);

        var nodes = await _dbContext.StorageNodes.Where(n => n.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        var childNodes = nodes.Where(n => n.ParentId != null).ToList();
        var rootNodes = nodes.Where(n => n.ParentId == null).ToList();
        _dbContext.StorageNodes.RemoveRange(childNodes);
        _dbContext.StorageNodes.RemoveRange(rootNodes);

        var allMembers = await _dbContext.WorkspaceMembers.Where(m => m.WorkspaceId == workspaceId).ToListAsync(cancellationToken);
        _dbContext.WorkspaceMembers.RemoveRange(allMembers);

        _dbContext.Workspaces.Remove(workspace);

        await _dbContext.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    public async Task LeaveWorkspaceAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        CancellationToken cancellationToken = default)
    {
        var user = await _userService.SyncCurrentUserAsync(identity, cancellationToken);

        var member = await _dbContext.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == user.Id, cancellationToken);

        if (member == null)
        {
            throw new UnauthorizedAccessException("User is not a member of this Storage Space.");
        }

        var allMembers = await _dbContext.WorkspaceMembers
            .Where(m => m.WorkspaceId == workspaceId)
            .ToListAsync(cancellationToken);

        if (allMembers.Count <= 1)
        {
            throw new InvalidOperationException("You cannot leave this Storage Space because you are the only member.");
        }

        if (member.Role == WorkspaceRole.OWNER)
        {
            var otherOwners = allMembers.Any(m => m.UserId != user.Id && m.Role == WorkspaceRole.OWNER);
            if (!otherOwners)
            {
                throw new InvalidOperationException("You cannot leave this Storage Space until another owner is assigned.");
            }
        }

        _dbContext.WorkspaceMembers.Remove(member);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<WorkspaceAuditResponseDto>> GetWorkspaceAuditsAsync(
        AuthenticatedIdentity identity,
        CancellationToken cancellationToken = default)
    {
        var user = await _userService.SyncCurrentUserAsync(identity, cancellationToken);
        var userIdStr = user.Id.ToString();

        // Retrieve active workspaces caller currently has membership in
        var activeWorkspaceIds = await _dbContext.WorkspaceMembers
            .Where(m => m.UserId == user.Id)
            .Select(m => m.WorkspaceId)
            .ToListAsync(cancellationToken);

        // Retrieve audits where:
        // 1. Caller is an active member of the workspace, OR
        // 2. Caller's User ID was recorded in AllowedUserIds at event time (for historical deleted workspaces), OR
        // 3. Caller was the actor who created/deleted the workspace
        var audits = await _dbContext.WorkspaceAudits
            .AsNoTracking()
            .Where(a => activeWorkspaceIds.Contains(a.WorkspaceId) ||
                        a.AllowedUserIds.Contains(userIdStr) ||
                        a.ActorUserId == userIdStr)
            .OrderByDescending(a => a.OccurredAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        return audits
            .Select(a => new WorkspaceAuditResponseDto(
                a.Id,
                a.WorkspaceId,
                a.WorkspaceName,
                a.InventoryNamespaceId,
                a.EventType,
                a.ActorUserId,
                a.OccurredAt,
                a.DetailsJson))
            .ToList();
    }
}
