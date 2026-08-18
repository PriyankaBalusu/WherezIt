using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WherezIt.Application.AI.Dtos;
using WherezIt.Application.AI.Services;
using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class AICaptureReviewService : IAICaptureReviewService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IBreadcrumbService _breadcrumbService;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public AICaptureReviewService(
        WherezItDbContext dbContext,
        IBreadcrumbService breadcrumbService,
        IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _breadcrumbService = breadcrumbService;
        _authorizationService = authorizationService;
    }

    public async Task<CaptureReviewResponseDto> GetCaptureReviewAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid captureId,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        var capture = await _dbContext.InventoryCaptures
            .AsNoTracking()
            .Include(c => c.Container)
            .ThenInclude(cont => cont.StorageNode)
            .Include(c => c.Suggestions)
            .Include(c => c.Jobs)
            .FirstOrDefaultAsync(c => c.Id == captureId && c.WorkspaceId == workspaceId, cancellationToken);

        if (capture == null)
        {
            throw new KeyNotFoundException($"Inventory capture '{captureId}' was not found in workspace '{workspaceId}'.");
        }

        var statusStr = capture.Status.ToString().ToUpperInvariant();
        string normalizedStatus = statusStr switch
        {
            "UPLOADED" or "QUEUED" or "PROCESSING" => "PROCESSING",
            "FAILED" => "FAILED",
            "REVIEW_REQUIRED" => "REVIEW_REQUIRED",
            "CONFIRMED" => "CONFIRMED",
            _ => statusStr
        };

        var boxDisplayId = capture.Container.BoxNumber < 1000 ? $"BOX {capture.Container.BoxNumber:D3}" : $"BOX {capture.Container.BoxNumber}";

        string breadcrumbDisplay = string.Empty;
        if (capture.Container.StorageNodeId != Guid.Empty)
        {
            try
            {
                var breadcrumb = await _breadcrumbService.GetBreadcrumbAsync(identity, workspaceId, capture.Container.StorageNodeId, cancellationToken);
                breadcrumbDisplay = breadcrumb.DisplayPath;
            }
            catch
            {
                breadcrumbDisplay = capture.Container.StorageNode?.Name ?? string.Empty;
            }
        }

        var latestJob = capture.Jobs.OrderByDescending(j => j.CreatedAt).FirstOrDefault();
        string? failureReason = latestJob?.LastError;

        var suggestionDtos = capture.Suggestions
            .Where(s => !s.IsRemoved)
            .Select(s => new DetectionSuggestionDto
            {
                Id = s.Id,
                SuggestedName = s.Name,
                SuggestedQuantity = s.Quantity,
                ConfidenceScore = (double)(s.Confidence ?? 0m)
            })
            .ToList();

        return new CaptureReviewResponseDto
        {
            CaptureId = capture.Id,
            WorkspaceId = capture.WorkspaceId,
            ContainerId = capture.ContainerId,
            BoxNumber = capture.Container.BoxNumber,
            BoxDisplayId = boxDisplayId,
            ImageId = capture.ImageAssetId,
            Status = normalizedStatus,
            BreadcrumbDisplay = breadcrumbDisplay,
            FailureReason = failureReason,
            Suggestions = suggestionDtos
        };
    }
}
