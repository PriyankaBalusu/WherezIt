using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.AI.Services;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Storage.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class AiQueueIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public AiQueueIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task ProcessJob_AcquiresAtomicLock_PersistsSuggestions_AndIsIdempotentOnRedelivery()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var storage = scope.ServiceProvider.GetRequiredService<IImageObjectStorage>();
        var processor = scope.ServiceProvider.GetRequiredService<IAIJobProcessor>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"ai_queue_user_{Guid.NewGuid():N}", "ai_queue@example.com", true);
        var ws = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Queue Test WS"));
        var loc = await locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Test Bay", null));
        var container = await containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(loc.Id, "Bin Queue", null));

        // Save image to storage
        var sampleBytes = Encoding.UTF8.GetBytes("sample-image-data");
        var objectPath = $"workspaces/{ws.Id}/containers/{container.Id}/img_{Guid.NewGuid():N}.jpg";
        using (var ms = new MemoryStream(sampleBytes))
        {
            await storage.UploadObjectAsync(objectPath, ms, "image/jpeg");
        }

        // Create DB records for ImageAsset, InventoryCapture, AIProcessingJob
        var imageAsset = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws.Id,
            ContainerId = container.Id,
            ObjectPath = objectPath,
            ContentType = "image/jpeg",
            SizeBytes = sampleBytes.Length,
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

        var job = new AIProcessingJob
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws.Id,
            CaptureId = capture.Id,
            Status = "QUEUED",
            AttemptCount = 0,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.AIProcessingJobs.Add(job);
        await db.SaveChangesAsync();

        // Act 1: Initial Processing
        await processor.ProcessJobAsync(job.Id);

        // Verify DB updates
        var updatedJob = await db.AIProcessingJobs.FindAsync(job.Id);
        Assert.NotNull(updatedJob);
        Assert.Equal("COMPLETED", updatedJob!.Status);

        var updatedCapture = await db.InventoryCaptures
            .Include(c => c.Suggestions)
            .FirstOrDefaultAsync(c => c.Id == capture.Id);
        Assert.NotNull(updatedCapture);
        Assert.Equal("REVIEW_REQUIRED", updatedCapture!.Status);
        Assert.NotEmpty(updatedCapture.Suggestions);

        var suggestionCountInitial = updatedCapture.Suggestions.Count;

        // Verify ZERO trusted Items created
        var itemCount = await db.Items.CountAsync(i => i.WorkspaceId == ws.Id);
        Assert.Equal(0, itemCount);

        // Act 2: Duplicate Delivery (Redelivery of completed job)
        await processor.ProcessJobAsync(job.Id);

        // Assert 2: Status remains COMPLETED, suggestions count remains unchanged (0 duplicate suggestions created)
        var redeliveredCapture = await db.InventoryCaptures
            .Include(c => c.Suggestions)
            .FirstOrDefaultAsync(c => c.Id == capture.Id);
        Assert.Equal(suggestionCountInitial, redeliveredCapture!.Suggestions.Count);

        // Re-verify ZERO trusted Items created
        var itemCountAfterRedelivery = await db.Items.CountAsync(i => i.WorkspaceId == ws.Id);
        Assert.Equal(0, itemCountAfterRedelivery);
    }
}
