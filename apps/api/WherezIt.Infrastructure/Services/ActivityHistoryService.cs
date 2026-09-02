using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WherezIt.Application.ActivityHistory.Dtos;
using WherezIt.Application.ActivityHistory.Services;
using WherezIt.Application.Authentication;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class ActivityHistoryService : IActivityHistoryService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public ActivityHistoryService(WherezItDbContext dbContext, IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<List<ActivityHistoryDto>> GetContainerHistoryAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var rawHistoryList = await _dbContext.ActivityHistories
            .AsNoTracking()
            .Where(a => a.ContainerId == containerId)
            .OrderByDescending(a => a.OccurredAt)
            .ThenByDescending(a => a.Id)
            .ToListAsync(cancellationToken);

        var result = new List<ActivityHistoryDto>();
        var processedTransferPairs = new HashSet<Guid>();

        foreach (var history in rawHistoryList)
        {
            if (processedTransferPairs.Contains(history.Id))
            {
                continue;
            }

            // Deduplicate paired TRANSFERRED_OUT / TRANSFERRED_IN events for the same transfer operation
            if (history.ActivityType == "TRANSFERRED_OUT" || history.ActivityType == "TRANSFERRED_IN")
            {
                var paired = rawHistoryList.FirstOrDefault(other =>
                    other.Id != history.Id &&
                    (other.ActivityType == "TRANSFERRED_OUT" || other.ActivityType == "TRANSFERRED_IN") &&
                    other.ActivityType != history.ActivityType &&
                    Math.Abs((other.OccurredAt - history.OccurredAt).TotalSeconds) < 2
                );

                if (paired != null)
                {
                    processedTransferPairs.Add(paired.Id);
                }
            }

            var (title, description) = MapToPresentation(history);

            result.Add(new ActivityHistoryDto(
                history.Id,
                history.ActivityType,
                title,
                description,
                history.ContainerId,
                history.WorkspaceId,
                history.ActorUserId,
                history.OccurredAt
            ));
        }

        return result;
    }

    private static (string Title, string Description) MapToPresentation(ActivityHistory history)
    {
        return history.ActivityType switch
        {
            "CONTAINER_CREATED" => (
                "Box created",
                string.IsNullOrWhiteSpace(history.DestinationLocationDisplay)
                    ? "Box created"
                    : $"Created in {history.DestinationLocationDisplay}"
            ),
            "CONTAINER_RENAMED" => (
                "Box renamed",
                $"Renamed from \"{history.PreviousLocationDisplay}\" to \"{history.DestinationLocationDisplay}\""
            ),
            "CONTAINER_MOVED" => (
                "Moved box",
                string.IsNullOrWhiteSpace(history.PreviousLocationDisplay)
                    ? history.DestinationLocationDisplay
                    : $"{history.PreviousLocationDisplay} → {history.DestinationLocationDisplay}"
            ),
            "TRANSFERRED_OUT" or "TRANSFERRED_IN" => (
                "Transferred box",
                string.IsNullOrWhiteSpace(history.PreviousLocationDisplay)
                    ? history.DestinationLocationDisplay
                    : $"{history.PreviousLocationDisplay} → {history.DestinationLocationDisplay}"
            ),
            "CONTAINER_PACKED" => (
                "Box packed",
                "Box marked as packed"
            ),
            "CONTAINER_UNPACKED" => (
                "Box unpacked",
                "Box marked as unpacked"
            ),
            "CONTAINER_ARCHIVED" => (
                "Box archived",
                "Box moved to archive"
            ),
            "CONTAINER_RESTORED" => (
                "Box restored",
                "Box restored from archive"
            ),
            "ITEM_ADDED" => (
                "Item added",
                FormatItemSnapshot(history.DestinationLocationDisplay)
            ),
            "ITEM_UPDATED" => (
                "Item updated",
                FormatItemSnapshot(history.DestinationLocationDisplay)
            ),
            "ITEM_ARCHIVED" => (
                "Item archived",
                FormatItemSnapshot(history.DestinationLocationDisplay)
            ),
            "ITEM_RESTORED" => (
                "Item restored",
                FormatItemSnapshot(history.DestinationLocationDisplay)
            ),
            "ITEM_REMOVED" => (
                "Item removed",
                FormatItemSnapshot(history.DestinationLocationDisplay)
            ),
            "PHOTO_ADDED" => (
                "Photo added",
                string.IsNullOrWhiteSpace(history.DestinationLocationDisplay) ? "Photo uploaded" : $"{history.DestinationLocationDisplay} photo uploaded"
            ),
            "PHOTO_REMOVED" => (
                "Photo removed",
                string.IsNullOrWhiteSpace(history.DestinationLocationDisplay) ? "Photo removed" : $"{history.DestinationLocationDisplay} photo removed"
            ),
            _ => (
                history.ActivityType.Replace('_', ' '),
                history.DestinationLocationDisplay
            )
        };
    }

    private static string FormatItemSnapshot(string display)
    {
        if (string.IsNullOrWhiteSpace(display)) return string.Empty;
        return display.Replace(" (Qty: ", " · Qty ").Replace(")", "");
    }
}
