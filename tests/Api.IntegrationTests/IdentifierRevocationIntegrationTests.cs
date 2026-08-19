using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Identifiers.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class IdentifierRevocationIntegrationTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public IdentifierRevocationIntegrationTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task IdentifierRevocation_Flow_ResolvesSafely_EnforcesTenantBoundaries_AndAllowsLazyReplacement()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();

        var userA = new AuthenticatedIdentity("user-rev-1", "usera@rev.test", true);
        var userB = new AuthenticatedIdentity("user-rev-2", "userb@rev.test", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(userA, new CreateWorkspaceRequestDto("Revocation WS A"));
        var wsB = await workspaceService.CreateWorkspaceAsync(userB, new CreateWorkspaceRequestDto("Revocation WS B"));

        var locA = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Storage A", null));
        var containerA = await containerService.CreateContainerAsync(userA, wsA.Id, new CreateContainerRequestDto(locA.Id, "Box Rev A", "Desc A"));

        // 1. Acquire active QR and BARCODE tokens
        var qr1 = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, containerA.Id, "QR");
        var bar1 = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, containerA.Id, "BARCODE");

        Assert.NotNull(qr1);
        Assert.NotNull(bar1);

        // Active tokens resolve normally
        var resQr1 = await identifierService.ResolveAuthorizedContainerAsync(userA, qr1.Value);
        Assert.Equal(containerA.Id, resQr1.ContainerId);

        // 2. Revoke QR identifier
        var revokeRes = await identifierService.RevokeIdentifierAsync(userA, wsA.Id, qr1.Id);
        Assert.Equal(qr1.Id, revokeRes.IdentifierId);
        Assert.True(revokeRes.IsRevoked);
        Assert.NotNull(revokeRes.RevokedAt);

        // 3. Verify revoked QR no longer resolves (returns safe unavailable 404 exception)
        await Assert.ThrowsAsync<KeyNotFoundException>(async () =>
            await identifierService.ResolveAuthorizedContainerAsync(userA, qr1.Value));

        // 4. QR revocation does NOT affect BARCODE
        var resBar1 = await identifierService.ResolveAuthorizedContainerAsync(userA, bar1.Value);
        Assert.Equal(containerA.Id, resBar1.ContainerId);

        // 5. Repeat revoke is IDEMPOTENT and preserves original RevokedAt
        var repeatRevoke = await identifierService.RevokeIdentifierAsync(userA, wsA.Id, qr1.Id);
        Assert.True(repeatRevoke.IsRevoked);
        Assert.Equal(revokeRes.RevokedAt, repeatRevoke.RevokedAt);

        // 6. Post-revocation acquisition generates NEW active token (differing from revoked token)
        var qr2 = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, containerA.Id, "QR");
        Assert.NotEqual(qr1.Value, qr2.Value);
        Assert.NotEqual(qr1.Id, qr2.Id);

        // Newly acquired replacement resolves normally
        var resQr2 = await identifierService.ResolveAuthorizedContainerAsync(userA, qr2.Value);
        Assert.Equal(containerA.Id, resQr2.ContainerId);

        // Both old revoked and new active rows exist in DB
        var dbRows = await db.Identifiers.AsNoTracking().Where(i => i.WorkspaceId == wsA.Id && i.ContainerId == containerA.Id && i.Type == "QR").ToListAsync();
        Assert.Equal(2, dbRows.Count);

        // 7. Tenant isolation: Nonmember cannot revoke
        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
            await identifierService.RevokeIdentifierAsync(userB, wsA.Id, bar1.Id));

        // 8. Tenant isolation: Cross-workspace revoke denied
        await Assert.ThrowsAsync<KeyNotFoundException>(async () =>
            await identifierService.RevokeIdentifierAsync(userA, wsB.Id, bar1.Id));

        // 9. Archived container revocation allowed, but replacement acquisition rejected
        var archContainer = await containerService.CreateContainerAsync(userA, wsA.Id, new CreateContainerRequestDto(locA.Id, "Box Arch", "Desc Arch"));
        var archQr = await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, archContainer.Id, "QR");
        await containerService.ArchiveContainerAsync(userA, wsA.Id, archContainer.Id);

        var archRevoke = await identifierService.RevokeIdentifierAsync(userA, wsA.Id, archQr.Id);
        Assert.True(archRevoke.IsRevoked);

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await identifierService.GetOrCreateIdentifierAsync(userA, wsA.Id, archContainer.Id, "QR"));
    }
}
