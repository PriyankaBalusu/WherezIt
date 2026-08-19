using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class ItemService : IItemService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public ItemService(WherezItDbContext dbContext, IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<IReadOnlyList<ItemResponseDto>> GetItemsByContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        bool includeArchived = false,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var query = _dbContext.Items
            .AsNoTracking()
            .Where(i => i.WorkspaceId == workspaceId && i.ContainerId == containerId);

        if (!includeArchived)
        {
            query = query.Where(i => !i.IsArchived);
        }

        var items = await query
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(cancellationToken);

        return items.Select(MapToDto).ToList();
    }

    public async Task<ItemResponseDto> GetItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.Id == itemId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Item '{itemId}' was not found in workspace '{workspaceId}'.");
        }

        return MapToDto(item);
    }

    public async Task<ItemResponseDto> CreateItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CreateItemRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ArgumentException("Item name cannot be empty.", nameof(request));
        }

        if (request.Quantity < 1)
        {
            throw new ArgumentException("Item quantity must be greater than or equal to 1.", nameof(request));
        }

        var container = await _dbContext.Containers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        if (container.IsArchived)
        {
            throw new InvalidOperationException("Cannot create an item in an archived container.");
        }

        var now = DateTimeOffset.UtcNow;
        var item = new Item
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ContainerId = containerId,
            Name = request.Name.Trim(),
            Quantity = request.Quantity,
            Category = NormalizeCategory(request.Category),
            Source = "MANUAL",
            IsVerified = true,
            IsArchived = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.Items.Add(item);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task<ItemResponseDto> UpdateItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        UpdateItemRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.Id == itemId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Item '{itemId}' was not found in workspace '{workspaceId}'.");
        }

        if (request.Name != null)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                throw new ArgumentException("Item name cannot be empty.", nameof(request));
            }
            item.Name = request.Name.Trim();
        }

        if (request.Quantity.HasValue)
        {
            if (request.Quantity.Value < 1)
            {
                throw new ArgumentException("Item quantity must be greater than or equal to 1.", nameof(request));
            }
            item.Quantity = request.Quantity.Value;
        }

        if (request.Category != null)
        {
            item.Category = NormalizeCategory(request.Category);
        }

        item.UpdatedAt = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task<ItemResponseDto> ArchiveItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.Id == itemId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Item '{itemId}' was not found in workspace '{workspaceId}'.");
        }

        item.IsArchived = true;
        item.UpdatedAt = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    public async Task<ItemResponseDto> RestoreItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var item = await _dbContext.Items
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.Id == itemId, cancellationToken);

        if (item == null)
        {
            throw new KeyNotFoundException($"Item '{itemId}' was not found in workspace '{workspaceId}'.");
        }

        item.IsArchived = false;
        item.UpdatedAt = DateTimeOffset.UtcNow;
        await _dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(item);
    }

    private static string? NormalizeCategory(string? category)
    {
        if (string.IsNullOrWhiteSpace(category)) return null;
        var trimmed = category.Trim();
        if (trimmed.Length > 50)
        {
            throw new ArgumentException("Category cannot exceed 50 characters.");
        }
        return trimmed;
    }

    private static ItemResponseDto MapToDto(Item i)
    {
        return new ItemResponseDto(
            i.Id,
            i.WorkspaceId,
            i.ContainerId,
            i.Name,
            i.Quantity,
            i.Category,
            i.Source,
            i.IsVerified,
            i.IsArchived,
            i.CreatedAt,
            i.UpdatedAt
        );
    }
}
