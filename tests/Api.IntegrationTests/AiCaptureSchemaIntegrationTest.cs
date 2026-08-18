using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class AiCaptureSchemaIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public AiCaptureSchemaIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task MigrationApplies_AndTablesAndConstraintsExist()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"ai_test_user_{Guid.NewGuid():N}", "ai_test@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("AI Test WS"));
        var loc = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Lab", null));
        var container = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(loc.Id, "Bin 1", null));

        var imageAsset = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws.Id,
            ContainerId = container.Id,
            ObjectPath = $"workspaces/{ws.Id}/containers/{container.Id}/img1.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 2048,
            Status = "READY",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.ImageAssets.Add(imageAsset);

        var capture = new InventoryCapture
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws.Id,
            ContainerId = container.Id,
            ImageAssetId = imageAsset.Id,
            Status = "UPLOADED",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.InventoryCaptures.Add(capture);

        var suggestion = new DetectionSuggestion
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws.Id,
            CaptureId = capture.Id,
            Name = "Screwdriver",
            Quantity = 2,
            Confidence = 0.9500m,
            IsRemoved = false,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.DetectionSuggestions.Add(suggestion);

        var job = new AIProcessingJob
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws.Id,
            CaptureId = capture.Id,
            Status = "QUEUED",
            AttemptCount = 0,
            InputMetadata = "{\"model\":\"gemini-1.5-flash\"}",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.AIProcessingJobs.Add(job);

        await db.SaveChangesAsync();

        // Verify queryability
        var fetchedCapture = await db.InventoryCaptures
            .Include(c => c.ImageAsset)
            .Include(c => c.Suggestions)
            .Include(c => c.Jobs)
            .FirstOrDefaultAsync(c => c.Id == capture.Id);

        Assert.NotNull(fetchedCapture);
        Assert.Equal("UPLOADED", fetchedCapture!.Status);
        Assert.Single(fetchedCapture.Suggestions);
        Assert.Equal("Screwdriver", fetchedCapture.Suggestions.First().Name);
        Assert.Single(fetchedCapture.Jobs);

        // Verify zero items created
        var itemContainerCount = await db.Items.CountAsync(i => i.ContainerId == container.Id);
        Assert.Equal(0, itemContainerCount);
    }

    [Fact]
    public async Task CrossWorkspaceCaptureReference_ThrowsDbUpdateException()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"cross_ai_user_{Guid.NewGuid():N}", "cross_ai@example.com", true);
        var ws1 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("WS1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("WS2"));
        var loc = await locationService.CreateLocationAsync(identity, ws1.Id, new CreateStorageLocationRequestDto("Loc", null));
        var containerWs1 = await containerService.CreateContainerAsync(identity, ws1.Id, new CreateContainerRequestDto(loc.Id, "Bin WS1", null));

        var imageAssetWs1 = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            ContainerId = containerWs1.Id,
            ObjectPath = "path",
            ContentType = "image/jpeg",
            SizeBytes = 100,
            Status = "READY",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.ImageAssets.Add(imageAssetWs1);
        await db.SaveChangesAsync();

        // Attempt to create a capture in WS2 referencing containerWs1 (WS1)
        var invalidCapture = new InventoryCapture
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws2.Id, // Mismatched workspace!
            ContainerId = containerWs1.Id,
            ImageAssetId = imageAssetWs1.Id,
            Status = "UPLOADED",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.InventoryCaptures.Add(invalidCapture);

        await Assert.ThrowsAsync<DbUpdateException>(async () => await db.SaveChangesAsync());
    }

    [Fact]
    public async Task InvalidStatus_ThrowsDbUpdateException()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"status_ai_user_{Guid.NewGuid():N}", "status@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Status WS"));

        var invalidAsset = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws.Id,
            ObjectPath = "path",
            ContentType = "image/jpeg",
            SizeBytes = 100,
            Status = "INVALID_STATUS", // Violates CK_image_assets_status_valid
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.ImageAssets.Add(invalidAsset);

        await Assert.ThrowsAsync<DbUpdateException>(async () => await db.SaveChangesAsync());
    }
}
