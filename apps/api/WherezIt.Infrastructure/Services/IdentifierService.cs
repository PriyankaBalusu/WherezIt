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

        var existingActive = await _dbContext.Identifiers
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.ContainerId == containerId && i.Type == normalizedType && !i.IsRevoked, cancellationToken);

        if (existingActive != null)
        {
            var labelName = normalizedType == "QR" ? "QR code" : "barcode";
            throw new InvalidOperationException($"This box already has an active {labelName}. Revoke it before adding another {labelName}.");
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
                .FromSqlRaw("SELECT * FROM containers WHERE id = {0} AND workspace_id = {1} FOR UPDATE", containerId, workspaceId)
                .FirstOrDefaultAsync(cancellationToken);

            if (container == null)
            {
                throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
            }

            if (container.IsArchived)
            {
                throw new InvalidOperationException($"Cannot acquire new {normalizedType} label for archived container.");
            }

            var existing = await _dbContext.Identifiers
                .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.ContainerId == containerId && i.Type == normalizedType && !i.IsRevoked, cancellationToken);

            if (existing != null)
            {
                await transaction.RollbackAsync(cancellationToken);
                var labelName = normalizedType == "QR" ? "QR code" : "barcode";
                throw new InvalidOperationException($"This box already has an active {labelName}. Revoke it before adding another {labelName}.");
            }

            var tokenValue = GenerateSecureToken(normalizedType);
            var identifier = new Identifier
            {
                Id = Guid.NewGuid(),
                WorkspaceId = workspaceId,
                ContainerId = containerId,
                Type = normalizedType,
                Value = tokenValue,
                IsRevoked = false,
                RevokedAt = null,
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
            .FirstOrDefaultAsync(i => i.Value == tokenValue.Trim() && !i.IsRevoked, cancellationToken);

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

        // If an absolute scan URL was supplied directly to the resolve service, extract the scan token
        if (trimmed.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            trimmed.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
        {
            if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri))
            {
                var segments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);
                var scanIdx = Array.IndexOf(segments, "scan");
                if (scanIdx >= 0 && scanIdx < segments.Length - 1)
                {
                    trimmed = Uri.UnescapeDataString(segments[scanIdx + 1]);
                }
            }
        }

        var identifier = await _dbContext.Identifiers
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Value == trimmed && !i.IsRevoked, cancellationToken);

        if (identifier == null)
        {
            throw new KeyNotFoundException("Container not found or unavailable.");
        }

        // Workspace authorization check BEFORE loading container details
        try
        {
            await _authorizationService.RequireWorkspaceMembershipAsync(identity, identifier.WorkspaceId, cancellationToken);
        }
        catch (UnauthorizedAccessException)
        {
            throw new KeyNotFoundException("Container not found or unavailable.");
        }

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

    public async Task<WherezIt.Application.Identifiers.Dtos.RevokeIdentifierResponseDto> RevokeIdentifierAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid identifierId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            var identifier = await _dbContext.Identifiers
                .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.Id == identifierId, cancellationToken);

            if (identifier == null)
            {
                throw new KeyNotFoundException($"Identifier '{identifierId}' was not found in workspace '{workspaceId}'.");
            }

            var container = await _dbContext.Containers
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == identifier.ContainerId, cancellationToken);

            if (container == null)
            {
                throw new KeyNotFoundException($"Container '{identifier.ContainerId}' was not found in workspace '{workspaceId}'.");
            }

            if (!identifier.IsRevoked)
            {
                var now = DateTimeOffset.UtcNow;
                identifier.IsRevoked = true;
                identifier.RevokedAt = now;
                identifier.UpdatedAt = now;
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);

            return new WherezIt.Application.Identifiers.Dtos.RevokeIdentifierResponseDto(
                identifier.Id,
                identifier.Type,
                identifier.IsRevoked,
                identifier.RevokedAt
            );
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private const string ShortBarcodeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

    private static string GenerateShortBarcodeToken()
    {
        Span<char> chars = stackalloc char[12];
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = ShortBarcodeAlphabet[
                RandomNumberGenerator.GetInt32(ShortBarcodeAlphabet.Length)
            ];
        }
        return "WZB_" + new string(chars);
    }

    private static string GenerateSecureToken(string type)
    {
        if (type == "QR")
        {
            var randomBytes = new byte[24]; // 192 bits of entropy
            RandomNumberGenerator.Fill(randomBytes);
            var base64 = Convert.ToBase64String(randomBytes)
                .Replace('+', '-')
                .Replace('/', '_')
                .TrimEnd('=');
            return "wzi_qr_" + base64;
        }

        return GenerateShortBarcodeToken();
    }

    public async Task<IdentifierDto> AttachCustomIdentifierAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        string type,
        string value,
        CancellationToken cancellationToken = default)
    {
        var normalizedType = type?.Trim().ToUpperInvariant();
        if (normalizedType != "QR" && normalizedType != "BARCODE")
        {
            throw new ArgumentException("Identifier type must be either 'QR' or 'BARCODE'.");
        }

        var trimmedValue = value?.Trim();
        if (string.IsNullOrWhiteSpace(trimmedValue) || trimmedValue.Length > 200)
        {
            throw new ArgumentException("Identifier value must not be empty or exceed 200 characters.");
        }

        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var container = await _dbContext.Containers
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (container == null)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        if (container.IsArchived)
        {
            throw new InvalidOperationException("Cannot attach identifier to an archived container.");
        }

        // Query by exact Value WITHOUT filtering revoked rows
        var existing = await _dbContext.Identifiers
            .FirstOrDefaultAsync(i => i.Value == trimmedValue, cancellationToken);

        if (existing != null)
        {
            if (!existing.IsRevoked)
            {
                if (existing.WorkspaceId == workspaceId && existing.ContainerId == containerId)
                {
                    var displayBox = $"BOX {container.BoxNumber:D3}";
                    throw new InvalidOperationException($"This identifier is already attached to {displayBox}.");
                }
                else
                {
                    // Cross-workspace or different container -> non-disclosure
                    throw new InvalidOperationException("This identifier is already in use.");
                }
            }
            else
            {
                // CASE C: existing.IsRevoked == true & different container -> BLOCK
                if (existing.ContainerId != containerId)
                {
                    throw new InvalidOperationException("This identifier was previously assigned to another box and cannot be reassigned automatically.");
                }

                // TYPE SAFETY: Submitted type vs existing stored type safety check
                if (existing.Type != normalizedType)
                {
                    var originalLabel = existing.Type == "QR" ? "QR code" : "barcode";
                    var attemptedLabel = normalizedType == "QR" ? "QR code" : "barcode";
                    throw new InvalidOperationException($"This identifier was previously registered as a {originalLabel} and cannot be reattached as a {attemptedLabel}.");
                }

                // ACTIVE-TYPE CONSTRAINT: Check for another active identifier of SAME type on target container
                var activeSameType = await _dbContext.Identifiers
                    .AnyAsync(i => i.WorkspaceId == workspaceId &&
                                  i.ContainerId == containerId &&
                                  i.Type == existing.Type &&
                                  !i.IsRevoked &&
                                  i.Id != existing.Id, cancellationToken);

                if (activeSameType)
                {
                    var labelName = existing.Type == "QR" ? "QR code" : "barcode";
                    throw new InvalidOperationException($"This box already has an active {labelName}. Revoke it before adding another {labelName}.");
                }

                // CASE A: Reactivate existing row for same container
                var now = DateTimeOffset.UtcNow;
                existing.IsRevoked = false;
                existing.RevokedAt = null;
                existing.UpdatedAt = now;

                await _dbContext.SaveChangesAsync(cancellationToken);

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
        }

        // NEW IDENTIFIER PATH: No existing row with this Value
        var activeSameTypeNew = await _dbContext.Identifiers
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.WorkspaceId == workspaceId && i.ContainerId == containerId && i.Type == normalizedType && !i.IsRevoked, cancellationToken);

        if (activeSameTypeNew != null)
        {
            var labelName = normalizedType == "QR" ? "QR code" : "barcode";
            throw new InvalidOperationException($"This box already has an active {labelName}. Revoke it before adding another {labelName}.");
        }

        var identifier = new Identifier
        {
            Id = Guid.NewGuid(),
            WorkspaceId = workspaceId,
            ContainerId = containerId,
            Type = normalizedType,
            Value = trimmedValue,
            IsRevoked = false,
            RevokedAt = null,
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

    public async Task<System.Collections.Generic.List<IdentifierDto>> GetContainerIdentifiersAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var containerExists = await _dbContext.Containers
            .AsNoTracking()
            .AnyAsync(c => c.WorkspaceId == workspaceId && c.Id == containerId, cancellationToken);

        if (!containerExists)
        {
            throw new KeyNotFoundException($"Container '{containerId}' was not found in workspace '{workspaceId}'.");
        }

        var list = await _dbContext.Identifiers
            .AsNoTracking()
            .Where(i => i.WorkspaceId == workspaceId && i.ContainerId == containerId && !i.IsRevoked)
            .OrderBy(i => i.CreatedAt)
            .Select(i => new IdentifierDto
            {
                Id = i.Id,
                WorkspaceId = i.WorkspaceId,
                ContainerId = i.ContainerId,
                Type = i.Type,
                Value = i.Value,
                CreatedAt = i.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return list;
    }
}
