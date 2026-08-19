using System;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Authentication;
using WherezIt.Application.Identifiers.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class IdentifierService : IIdentifierService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public IdentifierService(
        WherezItDbContext dbContext,
        IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<IdentifierDto> CreateIdentifierAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        string type,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var normalizedType = type?.Trim().ToUpperInvariant();
        if (normalizedType != "QR" && normalizedType != "BARCODE")
        {
            throw new ArgumentException("Identifier type must be either 'QR' or 'BARCODE'.");
        }

        var container = await _dbContext.Containers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == containerId && c.WorkspaceId == workspaceId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        // Generate cryptographically secure token
        var tokenValue = GenerateSecureToken(normalizedType);

        var identifier = new Identifier
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ContainerId = containerId,
            Type = normalizedType,
            Value = tokenValue,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow,
        };

        _dbContext.Identifiers.Add(identifier);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return new IdentifierDto
        {
            Id = identifier.Id,
            WorkspaceId = identifier.WorkspaceId,
            ContainerId = identifier.ContainerId,
            Type = identifier.Type,
            Value = identifier.Value,
            CreatedAt = identifier.CreatedAt
        };
    }

    public Task<IdentifierDto> GetOrCreateQrIdentifierAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        return GetOrCreateIdentifierAsync(identity, workspaceId, containerId, "QR", cancellationToken);
    }

    public async Task<IdentifierDto> GetOrCreateIdentifierAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        string type,
        CancellationToken cancellationToken = default)
    {
        var normalizedType = type?.Trim().ToUpperInvariant();
        if (normalizedType != "QR" && normalizedType != "BARCODE")
        {
            throw new ArgumentException("Identifier type must be either 'QR' or 'BARCODE'.");
        }

        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var container = await _dbContext.Containers
                .FromSqlRaw("SELECT * FROM containers WHERE id = {0} AND workspace_id = {1} FOR UPDATE;", containerId, workspaceId)
                .FirstOrDefaultAsync(cancellationToken);

            if (container == null)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
            }

            if (container.IsArchived)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new InvalidOperationException($"Cannot acquire new {normalizedType} label for archived container.");
            }

            var existing = await _dbContext.Identifiers
                .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.ContainerId == containerId && i.Type == normalizedType, cancellationToken);

            if (existing != null)
            {
                await transaction.CommitAsync(cancellationToken);
                return new IdentifierDto
                {
                    Id = existing.Id,
                    WorkspaceId = existing.WorkspaceId,
                    ContainerId = existing.ContainerId,
                    Type = existing.Type,
                    Value = existing.Value,
                    CreatedAt = existing.CreatedAt
                };
            }

            var tokenValue = GenerateSecureToken(normalizedType);
            var identifier = new Identifier
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                ContainerId = containerId,
                Type = normalizedType,
                Value = tokenValue,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = DateTimeOffset.UtcNow,
            };

            _dbContext.Identifiers.Add(identifier);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new IdentifierDto
            {
                Id = identifier.Id,
                WorkspaceId = identifier.WorkspaceId,
                ContainerId = identifier.ContainerId,
                Type = identifier.Type,
                Value = identifier.Value,
                CreatedAt = identifier.CreatedAt
            };
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<IdentifierDto> ResolveIdentifierAsync(
        AuthenticatedIdentity identity,
        string tokenValue,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(tokenValue))
        {
            throw new ArgumentException("Identifier value is required.");
        }

        var identifier = await _dbContext.Identifiers
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Value == tokenValue.Trim(), cancellationToken);

        if (identifier == null)
        {
            throw new KeyNotFoundException("Identifier token not found.");
        }

        // Authentication & workspace authorization enforced before returning container identity
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, identifier.WorkspaceId, cancellationToken);

        return new IdentifierDto
        {
            Id = identifier.Id,
            WorkspaceId = identifier.WorkspaceId,
            ContainerId = identifier.ContainerId,
            Type = identifier.Type,
            Value = identifier.Value,
            CreatedAt = identifier.CreatedAt
        };
    }

    public async Task<WherezIt.Application.Identifiers.Dtos.ResolvedContainerDto> ResolveAuthorizedContainerAsync(
        AuthenticatedIdentity identity,
        string tokenValue,
        CancellationToken cancellationToken = default)
    {
        var trimmed = tokenValue?.Trim();
        if (string.IsNullOrWhiteSpace(trimmed) || trimmed.Length > 200)
        {
            throw new KeyNotFoundException("Container not found or unavailable.");
        }

        if (!trimmed.StartsWith("wzi_qr_") && !trimmed.StartsWith("wzi_bar_"))
        {
            throw new KeyNotFoundException("Container not found or unavailable.");
        }

        var identifier = await _dbContext.Identifiers
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Value == trimmed, cancellationToken);

        if (identifier == null)
        {
            throw new KeyNotFoundException("Container not found or unavailable.");
        }

        // Workspace authorization check BEFORE loading container details
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, identifier.WorkspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == identifier.ContainerId && c.WorkspaceId == identifier.WorkspaceId, cancellationToken);

        if (container == null || container.IsArchived)
        {
            throw new KeyNotFoundException("Container not found or unavailable.");
        }

        // Build breadcrumb
        var breadcrumbParts = new System.Collections.Generic.List<string>();
        var currentNodeId = container.StorageNodeId;

        while (true)
        {
            var node = await _dbContext.StorageNodes
                .AsNoTracking()
                .FirstOrDefaultAsync(n => n.Id == currentNodeId && n.WorkspaceId == identifier.WorkspaceId, cancellationToken);

            if (node == null) break;

            breadcrumbParts.Insert(0, node.Name);

            if (node.ParentId == null) break;
            currentNodeId = node.ParentId.Value;
        }

        var breadcrumbDisplay = string.Join(" → ", breadcrumbParts);
        var locationName = breadcrumbParts.Count > 0 ? breadcrumbParts[breadcrumbParts.Count - 1] : "Unknown";

        // Load active trusted items
        var items = await _dbContext.Items
            .AsNoTracking()
            .Where(i => i.WorkspaceId == identifier.WorkspaceId && i.ContainerId == container.Id && !i.IsArchived)
            .OrderBy(i => i.Name)
            .Select(i => new WherezIt.Application.Identifiers.Dtos.ResolvedContainerItemDto
            {
                ItemId = i.Id,
                Name = i.Name,
                Quantity = i.Quantity
            })
            .ToListAsync(cancellationToken);

        return new WherezIt.Application.Identifiers.Dtos.ResolvedContainerDto
        {
            ContainerId = container.Id,
            WorkspaceId = container.WorkspaceId,
            BoxNumber = container.BoxNumber,
            BoxDisplayId = string.Format("BOX {0:D3}", container.BoxNumber),
            StorageNodeId = container.StorageNodeId,
            LocationName = locationName,
            BreadcrumbDisplay = breadcrumbDisplay,
            Items = items
        };
    }

    private static string GenerateSecureToken(string type)
    {
        var prefix = type == "QR" ? "wzi_qr_" : "wzi_bar_";
        var randomBytes = new byte[24]; // 192 bits of entropy
        RandomNumberGenerator.Fill(randomBytes);
        var base64 = Convert.ToBase64String(randomBytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
        return prefix + base64;
    }
}
