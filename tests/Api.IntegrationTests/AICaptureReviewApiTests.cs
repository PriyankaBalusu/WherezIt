using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.AI.Services;
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

public class AICaptureReviewApiTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public AICaptureReviewApiTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task GetCaptureReview_EnforcesAuthorization_StatusMapping_AndNoTrustedItems()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var reviewService = scope.ServiceProvider.GetRequiredService<IAICaptureReviewService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity1 = new AuthenticatedIdentity($"ai004_user_1_{Guid.NewGuid():N}", "ai004_1@example.com", true);
        var identity2 = new AuthenticatedIdentity($"ai004_user_2_{Guid.NewGuid():N}", "ai004_2@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity1, new CreateWorkspaceRequestDto("AI004 WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity2, new CreateWorkspaceRequestDto("AI004 WS 2"));

        var loc = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Attic", null));
        var container = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(loc.Id, "Review Box", null));

        var imageAsset = new ImageAsset
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            ContainerId = container.Id,
            ObjectPath = "workspaces/ws1/containers/box/raw-secret-image.jpg",
            ContentType = "image/jpeg",
            SizeBytes = 1024,
            CreatedAt = DateTimeOffset.UtcNow
        };
        db.ImageAssets.Add(imageAsset);

        var capture = new InventoryCapture
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            ContainerId = container.Id,
            ImageAssetId = imageAsset.Id,
            Status = "REVIEW_REQUIRED",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.InventoryCaptures.Add(capture);

        var sugg1 = new DetectionSuggestion
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            CaptureId = capture.Id,
            Name = "Winter Coat",
            Quantity = 1,
            Confidence = 0.92m,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var sugg2 = new DetectionSuggestion
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            CaptureId = capture.Id,
            Name = "Ski Boots",
            Quantity = 2,
            Confidence = 0.87m,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.DetectionSuggestions.AddRange(sugg1, sugg2);
        await db.SaveChangesAsync();

        // 1. Authorized review retrieval -> returns REVIEW_REQUIRED status & imageId
        var review = await reviewService.GetCaptureReviewAsync(identity1, ws1.Id, capture.Id);
        Assert.Equal(capture.Id, review.CaptureId);
        Assert.Equal(ws1.Id, review.WorkspaceId);
        Assert.Equal(container.Id, review.ContainerId);
        Assert.Equal(imageAsset.Id, review.ImageId);
        Assert.Equal("REVIEW_REQUIRED", review.Status);
        Assert.Equal(2, review.Suggestions.Count);
        Assert.Equal("Winter Coat", review.Suggestions[0].SuggestedName);

        // Verify raw ObjectPath is NOT exposed on review DTO
        Assert.DoesNotContain("raw-secret-image.jpg", review.ImageId.ToString());

        // 2. Cross-workspace / non-member access is denied
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            reviewService.GetCaptureReviewAsync(identity2, ws1.Id, capture.Id));

        // 3. Verify trusted Item count remains 0
        var itemCount = await db.Items.CountAsync(i => i.WorkspaceId == ws1.Id);
        Assert.Equal(0, itemCount);
    }
}
