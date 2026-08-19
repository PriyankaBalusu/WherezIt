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

public class PrintBarcodeLabelApiTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public PrintBarcodeLabelApiTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task AcquireBarcodeIdentifier_CreatesOrReusesBarcodeTokenAndSupportsConcurrency()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();

        var identity1 = new AuthenticatedIdentity("user-bar-1", "user1@example.com", true);

        // 1. Setup workspace, location, container
        var ws = await workspaceService.CreateWorkspaceAsync(identity1, new CreateWorkspaceRequestDto("Barcode WS"));
        var loc = await locationService.CreateLocationAsync(identity1, ws.Id, new CreateStorageLocationRequestDto("Storage Bay", null));
        var container = await containerService.CreateContainerAsync(identity1, ws.Id, new CreateContainerRequestDto(loc.Id, "Toolbox", "Red box"));

        // 2. Initial Barcode acquisition
        var bar1 = await identifierService.GetOrCreateIdentifierAsync(identity1, ws.Id, container.Id, "BARCODE");
        Assert.NotNull(bar1);
        Assert.Equal("BARCODE", bar1.Type);
        Assert.StartsWith("wzi_bar_", bar1.Value);

        // 3. Repeated acquisition reuses existing token
        var bar2 = await identifierService.GetOrCreateIdentifierAsync(identity1, ws.Id, container.Id, "BARCODE");
        Assert.Equal(bar1.Id, bar2.Id);
        Assert.Equal(bar1.Value, bar2.Value);

        // 4. QR and BARCODE coexist on same Container
        var qr1 = await identifierService.GetOrCreateIdentifierAsync(identity1, ws.Id, container.Id, "QR");
        Assert.Equal("QR", qr1.Type);
        Assert.StartsWith("wzi_qr_", qr1.Value);
        Assert.NotEqual(bar1.Value, qr1.Value);

        var identifierCount = await db.Identifiers.CountAsync(i => i.ContainerId == container.Id);
        Assert.Equal(2, identifierCount);

        // 5. Concurrent first acquisition test for new container
        var container2 = await containerService.CreateContainerAsync(identity1, ws.Id, new CreateContainerRequestDto(loc.Id, "Parts Bin", null));

        var task1 = Task.Run(async () =>
        {
            using var s = _fixture.Services.CreateScope();
            var service = s.ServiceProvider.GetRequiredService<IIdentifierService>();
            return await service.GetOrCreateIdentifierAsync(identity1, ws.Id, container2.Id, "BARCODE");
        });

        var task2 = Task.Run(async () =>
        {
            using var s = _fixture.Services.CreateScope();
            var service = s.ServiceProvider.GetRequiredService<IIdentifierService>();
            return await service.GetOrCreateIdentifierAsync(identity1, ws.Id, container2.Id, "BARCODE");
        });

        var results = await Task.WhenAll(task1, task2);
        Assert.Equal(results[0].Value, results[1].Value);

        var barRows = await db.Identifiers.Where(i => i.ContainerId == container2.Id && i.Type == "BARCODE").ToListAsync();
        Assert.Single(barRows);

        // 6. Archived Container rejects new BARCODE acquisition
        var archivedContainer = await containerService.CreateContainerAsync(identity1, ws.Id, new CreateContainerRequestDto(loc.Id, "Archived Box", null));
        await containerService.ArchiveContainerAsync(identity1, ws.Id, archivedContainer.Id);

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await identifierService.GetOrCreateIdentifierAsync(identity1, ws.Id, archivedContainer.Id, "BARCODE");
        });
    }
}
