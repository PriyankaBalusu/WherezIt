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

    [Fact]
    public async Task AttachCustomIdentifier_ConflictHandling_And_Resolution()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();

        var identity1 = new AuthenticatedIdentity($"id002_user_1_{Guid.NewGuid():N}", "id002_1@example.com", true);
        var identity2 = new AuthenticatedIdentity($"id002_user_2_{Guid.NewGuid():N}", "id002_2@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity1, new CreateWorkspaceRequestDto("Attach WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity2, new CreateWorkspaceRequestDto("Attach WS 2"));

        var loc1 = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Shelf B", null));
        var container1 = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(loc1.Id, "Box B1", null));
        var container2 = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(loc1.Id, "Box B2", null));

        var loc2 = await locationService.CreateLocationAsync(identity2, ws2.Id, new CreateStorageLocationRequestDto("Shelf C", null));
        var containerWs2 = await containerService.CreateContainerAsync(identity2, ws2.Id, new CreateContainerRequestDto(loc2.Id, "Box C1", null));

        // 1. Attach custom barcode to container1
        var attached = await identifierService.AttachCustomIdentifierAsync(identity1, ws1.Id, container1.Id, "BARCODE", "UPC-998877");
        Assert.Equal("BARCODE", attached.Type);
        Assert.Equal("UPC-998877", attached.Value);

        // 2. Fetch container identifiers
        var list = await identifierService.GetContainerIdentifiersAsync(identity1, ws1.Id, container1.Id);
        Assert.Contains(list, i => i.Value == "UPC-998877");

        // 3. Resolve custom identifier
        var resolved = await identifierService.ResolveAuthorizedContainerAsync(identity1, "UPC-998877");
        Assert.Equal(container1.Id, resolved.ContainerId);

        // 4. Attach same code to same box -> throws friendly conflict "already attached"
        var exSame = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            identifierService.AttachCustomIdentifierAsync(identity1, ws1.Id, container1.Id, "BARCODE", "UPC-998877"));
        Assert.Contains("already attached to", exSame.Message);

        // 5. Attach same code to different box in same workspace -> throws "already in use"
        var exDiff = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            identifierService.AttachCustomIdentifierAsync(identity1, ws1.Id, container2.Id, "BARCODE", "UPC-998877"));
        Assert.Equal("This identifier is already in use.", exDiff.Message);

        // 6. Attach same code in different workspace -> throws "already in use" without leaking cross-workspace info
        var exCross = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            identifierService.AttachCustomIdentifierAsync(identity2, ws2.Id, containerWs2.Id, "BARCODE", "UPC-998877"));
        Assert.Equal("This identifier is already in use.", exCross.Message);
    }
}
