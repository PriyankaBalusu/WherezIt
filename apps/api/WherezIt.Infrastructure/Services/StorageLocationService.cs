using Microsoft.EntityFrameworkCore;
using Npgsql;
using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class StorageLocationService : IStorageLocationService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public StorageLocationService(WherezItDbContext dbContext, IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<List<StorageLocationResponseDto>> GetLocationsAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var nodes = await _dbContext.StorageNodes
            .AsNoTracking()
            .Where(n => n.WorkspaceId == workspaceId)
            .OrderBy(n => n.Name)
            .ToListAsync(cancellationToken);

        return nodes.Select(MapToDto).ToList();
    }

    public async Task<StorageLocationResponseDto> GetLocationAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var node = await _dbContext.StorageNodes
            .AsNoTracking()
            .FirstOrDefaultAsync(n => n.WorkspaceId == workspaceId && n.Id == locationId, cancellationToken);

        if (node == null)
        {
            throw new KeyNotFoundException($"Storage location '{locationId}' was not found in workspace '{workspaceId}'.");
        }

        return MapToDto(node);
    }

    public async Task<StorageLocationResponseDto> CreateLocationAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        CreateStorageLocationRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var trimmedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            throw new ArgumentException("Location name cannot be empty.", nameof(request));
        }

        if (trimmedName.Length > 100)
        {
            throw new ArgumentException("Location name cannot exceed 100 characters.", nameof(request));
        }

        if (request.ParentId.HasValue)
        {
            var parent = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == request.ParentId.Value, cancellationToken);

            if (parent == null || parent.WorkspaceId != workspaceId)
            {
                throw new ArgumentException($"Target parent location '{request.ParentId}' does not exist in workspace '{workspaceId}'.", nameof(request));
            }
        }

        var now = DateTimeOffset.UtcNow;
        var node = new StorageNode
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ParentId = request.ParentId,
            Name = trimmedName,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.StorageNodes.Add(node);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(node);
    }

    public async Task<StorageLocationResponseDto> RenameLocationAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        RenameStorageLocationRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var trimmedName = request.Name?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedName))
        {
            throw new ArgumentException("Location name cannot be empty.", nameof(request));
        }

        if (trimmedName.Length > 100)
        {
            throw new ArgumentException("Location name cannot exceed 100 characters.", nameof(request));
        }

        var node = await _dbContext.StorageNodes
            .FirstOrDefaultAsync(n => n.WorkspaceId == workspaceId && n.Id == locationId, cancellationToken);

        if (node == null)
        {
            throw new KeyNotFoundException($"Storage location '{locationId}' was not found in workspace '{workspaceId}'.");
        }

        node.Name = trimmedName;
        node.UpdatedAt = DateTimeOffset.UtcNow;

        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(node);
    }

    public async Task DeleteLocationAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var node = await _dbContext.StorageNodes
            .FirstOrDefaultAsync(n => n.WorkspaceId == workspaceId && n.Id == locationId, cancellationToken);

        if (node == null)
        {
            throw new KeyNotFoundException($"Storage location '{locationId}' was not found in workspace '{workspaceId}'.");
        }

        try
        {
            _dbContext.StorageNodes.Remove(node);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            if (ex.InnerException is PostgresException pgEx &&
                pgEx.SqlState == "23503" &&
                !string.IsNullOrEmpty(pgEx.ConstraintName) &&
                pgEx.ConstraintName.Equals("FK_storage_nodes_storage_nodes_workspace_id_parent_id", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("Cannot delete storage location because it contains child locations.", ex);
            }

            throw;
        }
    }

    private static StorageLocationResponseDto MapToDto(StorageNode node)
    {
        return new StorageLocationResponseDto(
            node.Id,
            node.WorkspaceId,
            node.ParentId,
            node.Name,
            node.CreatedAt,
            node.UpdatedAt
        );
    }
}
