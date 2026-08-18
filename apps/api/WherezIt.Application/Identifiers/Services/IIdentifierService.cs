using System;
using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.Authentication;
using WherezIt.Domain.Entities;

namespace WherezIt.Application.Identifiers.Services;

public class IdentifierDto
{
    public Guid Id { get; set; }
    public Guid WorkspaceId { get; set; }
    public Guid ContainerId { get; set; }
    public string Type { get; set; } = null!;
    public string Value { get; set; } = null!;
    public DateTimeOffset CreatedAt { get; set; }
}

public interface IIdentifierService
{
    Task<IdentifierDto> CreateIdentifierAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        string type,
        CancellationToken cancellationToken = default);

    Task<IdentifierDto> ResolveIdentifierAsync(
        AuthenticatedIdentity identity,
        string tokenValue,
        CancellationToken cancellationToken = default);
}
