using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Identifiers.Services;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class IdentifierResolverApiTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public IdentifierResolverApiTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task ResolveAuthorizedContainer_EnforcesAuth_TenantIsolation_Breadcrumb_AndTrustedItems()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();
        var identifierService = scope.ServiceProvider.GetRequiredService<IIdentifierService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity1 = new AuthenticatedIdentity($"id004_user_1_{Guid.NewGuid():N}", "id004_1@example.com", true);
        var identity2 = new AuthenticatedIdentity($"id004_user_2_{Guid.NewGuid():N}", "id004_2@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity1, new CreateWorkspaceRequestDto("ID004 WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity2, new CreateWorkspaceRequestDto("ID004 WS 2"));

        var parentLoc = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Garage", null));
        var childLoc = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Shelf 2", parentLoc.Id));

        var container = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(childLoc.Id, "Scan Box", null));
        var qr = await identifierService.GetOrCreateQrIdentifierAsync(identity1, ws1.Id, container.Id);

        // Add trusted item
        await itemService.CreateItemAsync(identity1, ws1.Id, container.Id, new CreateItemRequestDto("Christmas Lights", 2));

        // Add DetectionSuggestion (should be excluded)
        var sugg = new DetectionSuggestion
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            CaptureId = Guid.NewGuid(),
            Name = "Untrusted AI Suggestion",
            Quantity = 1,
            Confidence = 0.8m,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.DetectionSuggestions.Add(sugg);
        await db.SaveChangesAsync();

        // 1. Authorized member resolves successfully
        var resolved = await identifierService.ResolveAuthorizedContainerAsync(identity1, qr.Value);
        Assert.NotNull(resolved);
        Assert.Equal(container.Id, resolved.ContainerId);
        Assert.Equal("Garage → Shelf 2", resolved.BreadcrumbDisplay);
        Assert.Single(resolved.Items);
        Assert.Equal("Christmas Lights", resolved.Items[0].Name);

        // 2. Non-member receives sanitized KeyNotFoundException (404 equivalent)
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            identifierService.ResolveAuthorizedContainerAsync(identity2, qr.Value));

        // 3. Invalid token returns safe KeyNotFoundException (404 equivalent)
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            identifierService.ResolveAuthorizedContainerAsync(identity1, "wzi_qr_nonexistenttoken"));

        // 4. Over-200-char token rejected
        var longToken = "wzi_qr_" + new string('a', 205);
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            identifierService.ResolveAuthorizedContainerAsync(identity1, longToken));

        // 5. Invalid prefix rejected
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            identifierService.ResolveAuthorizedContainerAsync(identity1, "invalid_prefix_123456789"));

        // 6. Moved container updates breadcrumb dynamically
        var newLoc = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Attic", null));
        var containerToMove = await db.Containers.FindAsync(container.Id);
        containerToMove!.StorageNodeId = newLoc.Id;
        await db.SaveChangesAsync();

        var resolvedAfterMove = await identifierService.ResolveAuthorizedContainerAsync(identity1, qr.Value);
        Assert.Equal("Attic", resolvedAfterMove.BreadcrumbDisplay);

        // 7. Archived container returns 404 equivalent
        await containerService.ArchiveContainerAsync(identity1, ws1.Id, container.Id);
        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            identifierService.ResolveAuthorizedContainerAsync(identity1, qr.Value));
    }
}
