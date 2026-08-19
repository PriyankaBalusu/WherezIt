using System;
using System.Linq;
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
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class PrintQrLabelApiTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public PrintQrLabelApiTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task AcquireQrIdentifier_ReusesExisting_EnforcesTenancy_AndHandlesConcurrentFirstAcquisition()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity1 = new AuthenticatedIdentity($"id002_user_1_{Guid.NewGuid():N}", "id002_1@example.com", true);
        var identity2 = new AuthenticatedIdentity($"id002_user_2_{Guid.NewGuid():N}", "id002_2@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity1, new CreateWorkspaceRequestDto("ID002 WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity2, new CreateWorkspaceRequestDto("ID002 WS 2"));

        var loc1 = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Attic", null));
        var container1 = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(loc1.Id, "Holiday Box", null));

        // 1. First QR acquisition
        var qr1 = await identifierService.GetOrCreateQrIdentifierAsync(identity1, ws1.Id, container1.Id);
        Assert.NotNull(qr1);
        Assert.StartsWith("wzi_qr_", qr1.Value);

        // 2. Repeated acquisition reuses existing QR token
        var qr2 = await identifierService.GetOrCreateQrIdentifierAsync(identity1, ws1.Id, container1.Id);
        Assert.Equal(qr1.Id, qr2.Id);
        Assert.Equal(qr1.Value, qr2.Value);

        // 3. REQUIRED CONCURRENCY TEST: Two simultaneous first-time QR acquisitions for same container
        var container2 = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(loc1.Id, "Concurrent Box", null));

        Task<IdentifierDto> task1 = Task.Run(async () =>
        {
            using var scope1 = _fixture.Services.CreateScope();
            var service1 = scope1.ServiceProvider.GetRequiredService<IIdentifierService>();
            return await service1.GetOrCreateQrIdentifierAsync(identity1, ws1.Id, container2.Id);
        });

        Task<IdentifierDto> task2 = Task.Run(async () =>
        {
            using var scope2 = _fixture.Services.CreateScope();
            var service2 = scope2.ServiceProvider.GetRequiredService<IIdentifierService>();
            return await service2.GetOrCreateQrIdentifierAsync(identity1, ws1.Id, container2.Id);
        });

        var results = await Task.WhenAll(task1, task2);
        Assert.Equal(results[0].Value, results[1].Value);

        var totalQrRows = await db.Identifiers.CountAsync(i => i.WorkspaceId == ws1.Id && i.ContainerId == container2.Id && i.Type == "QR");
        Assert.Equal(1, totalQrRows);

        // 4. Nonmember denied
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            identifierService.GetOrCreateQrIdentifierAsync(identity2, ws1.Id, container1.Id));

        // 5. Container move does not alter Identifier
        var loc2 = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Basement Shelf", null));
        var containerDb = await db.Containers.FindAsync(container1.Id);
        containerDb!.StorageNodeId = loc2.Id;
        await db.SaveChangesAsync();

        var qrAfterMove = await identifierService.GetOrCreateQrIdentifierAsync(identity1, ws1.Id, container1.Id);
        Assert.Equal(qr1.Value, qrAfterMove.Value);

        // 6. Archived container new QR acquisition rejected
        var containerArchived = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(loc1.Id, "Archived Box", null));
        await containerService.ArchiveContainerAsync(identity1, ws1.Id, containerArchived.Id);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            identifierService.GetOrCreateQrIdentifierAsync(identity1, ws1.Id, containerArchived.Id));
    }
}
