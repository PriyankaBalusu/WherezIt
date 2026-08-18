using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.AI.Dtos;
using WherezIt.Application.AI.Services;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Search.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class AICaptureConfirmationApiTests : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public AICaptureConfirmationApiTests(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task ConfirmCapture_CreatesTrustedItems_AtomicStatusTransition_PreventsDuplicateConfirmations()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var confirmService = scope.ServiceProvider.GetRequiredService<IAICaptureConfirmationService>();
        var searchService = scope.ServiceProvider.GetRequiredService<IWorkspaceSearchService>();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity1 = new AuthenticatedIdentity($"ai005_user_1_{Guid.NewGuid():N}", "ai005_1@example.com", true);
        var identity2 = new AuthenticatedIdentity($"ai005_user_2_{Guid.NewGuid():N}", "ai005_2@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity1, new CreateWorkspaceRequestDto("AI005 WS 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity2, new CreateWorkspaceRequestDto("AI005 WS 2"));

        var loc = await locationService.CreateLocationAsync(identity1, ws1.Id, new CreateStorageLocationRequestDto("Basement", null));
        var container = await containerService.CreateContainerAsync(identity1, ws1.Id, new CreateContainerRequestDto(loc.Id, "Confirmation Box", null));

        var capture = new InventoryCapture
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            ContainerId = container.Id,
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
            Name = "Raw Light String",
            Quantity = 1,
            Confidence = 0.90m,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var sugg2Removed = new DetectionSuggestion
        {
            Id = Guid.NewGuid(),
            WorkspaceId = ws1.Id,
            CaptureId = capture.Id,
            Name = "Garbage Bag",
            Quantity = 1,
            Confidence = 0.50m,
            IsRemoved = true,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        db.DetectionSuggestions.AddRange(sugg1, sugg2Removed);
        await db.SaveChangesAsync();

        // Confirmation payload with renamed item + custom added item (removed suggestion excluded)
        var confirmPayload = new ConfirmCaptureRequestDto
        {
            Items = new List<ConfirmItemDto>
            {
                new ConfirmItemDto { Name = "Renamed Fairy Lights", Quantity = 3, SuggestionId = sugg1.Id },
                new ConfirmItemDto { Name = "Custom Power Strip", Quantity = 1, SuggestionId = null }
            }
        };

        // 1. Successful confirmation
        var confirmResult = await confirmService.ConfirmCaptureAsync(identity1, ws1.Id, capture.Id, confirmPayload);
        Assert.Equal("CONFIRMED", confirmResult.Status);
        Assert.Equal(2, confirmResult.ConfirmedItemsCount);

        // 2. Verify created Items in DB
        var createdItems = await db.Items.Where(i => i.WorkspaceId == ws1.Id).ToListAsync();
        Assert.Equal(2, createdItems.Count);

        var item1 = createdItems.Find(i => i.Name == "Renamed Fairy Lights");
        Assert.NotNull(item1);
        Assert.Equal(3, item1.Quantity);
        Assert.Equal("AI_CONFIRMED", item1.Source);
        Assert.True(item1.IsVerified);
        Assert.False(item1.IsArchived);

        var item2 = createdItems.Find(i => i.Name == "Custom Power Strip");
        Assert.NotNull(item2);
        Assert.Equal(1, item2.Quantity);
        Assert.Equal("AI_CONFIRMED", item2.Source);
        Assert.True(item2.IsVerified);

        // 3. Duplicate confirmation attempt -> throws InvalidOperationException (409 Conflict)
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            confirmService.ConfirmCaptureAsync(identity1, ws1.Id, capture.Id, confirmPayload));

        // Verify total items count remains 2 (zero duplicate items created)
        var itemCountAfterDuplicate = await db.Items.CountAsync(i => i.WorkspaceId == ws1.Id);
        Assert.Equal(2, itemCountAfterDuplicate);

        // 4. Confirmed item is discoverable via SRCH-002
        var searchResults = await searchService.SearchWorkspaceAsync(identity1, ws1.Id, "Fairy Lights");
        Assert.Single(searchResults);
        Assert.Equal("ITEM", searchResults[0].ResultType);
        Assert.Equal("Renamed Fairy Lights", searchResults[0].ItemName);

        // 5. Validation checks: zero items rejected
        await Assert.ThrowsAsync<ArgumentException>(() =>
            confirmService.ConfirmCaptureAsync(identity1, ws1.Id, capture.Id, new ConfirmCaptureRequestDto { Items = new() }));

        // 6. Tenant isolation -> WS2 identity denied
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            confirmService.ConfirmCaptureAsync(identity2, ws1.Id, capture.Id, confirmPayload));
    }
}
