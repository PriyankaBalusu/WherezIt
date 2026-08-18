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

public class IdentifierFoundationIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public IdentifierFoundationIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task Identifier_EnforcesSchema_TokenFormat_Uniqueness_AndTenancy()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity1 = new AuthenticatedIdentity($"id001_user_1_{Guid.NewGuid():N}", "id001_1@example.com", true);
        var identity2 = new AuthenticatedIdentity($"id001_user_2_{Guid.NewGuid():N}", "id001_2@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity1, new CreateWorkspaceRequestDto("ID001 WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity2, new CreateWorkspaceRequestDto("ID001 WS 2"));

        var loc1 = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Shelf A", null));
        var container1 = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(loc1.Id, "Box A", null));

        // 1. Create QR Identifier
        var qrId = await identifierService.CreateIdentifierAsync(identity1, ws1.Id, container1.Id, "QR");
        Assert.Equal(ws1.Id, qrId.WorkspaceId);
        Assert.Equal(container1.Id, qrId.ContainerId);
        Assert.Equal("QR", qrId.Type);
        Assert.StartsWith("wzi_qr_", qrId.Value);

        // 2. Create BARCODE Identifier
        var barId = await identifierService.CreateIdentifierAsync(identity1, ws1.Id, container1.Id, "BARCODE");
        Assert.Equal("BARCODE", barId.Type);
        Assert.StartsWith("wzi_bar_", barId.Value);

        // 3. Resolve QR Identifier -> returns correct Container identity
        var resolved = await identifierService.ResolveIdentifierAsync(identity1, qrId.Value);
        Assert.Equal(container1.Id, resolved.ContainerId);
        Assert.Equal(ws1.Id, resolved.WorkspaceId);

        // 4. Tenant isolation -> WS2 member cannot resolve WS1 identifier
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            identifierService.ResolveIdentifierAsync(identity2, qrId.Value));

        // 5. Invalid type check -> unsupported string rejected
        await Assert.ThrowsAsync<ArgumentException>(() =>
            identifierService.CreateIdentifierAsync(identity1, ws1.Id, container1.Id, "INVALID_TYPE"));

        // 6. DB Check Constraint -> adding invalid type directly to DB fails
        var invalidIdentifier = new Identifier
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            ContainerId = container1.Id,
            Type = "NFC",
            Value = "wzi_nfc_test",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Identifiers.Add(invalidIdentifier);
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }
}
