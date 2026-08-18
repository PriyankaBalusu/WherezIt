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
