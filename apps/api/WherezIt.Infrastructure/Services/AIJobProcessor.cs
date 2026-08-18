using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WherezIt.Application.AI.Services;
using WherezIt.Application.Storage.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class AIJobProcessor : IAIJobProcessor
{
    private readonly WherezItDbContext _dbContext;
    private readonly IImageObjectStorage _storage;
    private readonly IInventoryVisionProvider _visionProvider;
    private readonly ILogger<AIJobProcessor> _logger;

    public AIJobProcessor(
        WherezItDbContext dbContext,
        IImageObjectStorage storage,
        IInventoryVisionProvider visionProvider,
        ILogger<AIJobProcessor> logger)
    {
        _dbContext = dbContext;
        _storage = storage;
        _visionProvider = visionProvider;
        _logger = logger;
    }

    public async Task ProcessJobAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        // 1. Atomic QUEUED -> RUNNING status acquisition
        var affectedRows = await _dbContext.Database.ExecuteSqlRawAsync(
            "UPDATE ai_processing_jobs SET status = 'RUNNING', updated_at = NOW() WHERE id = {0} AND status = 'QUEUED'",
            new object[] { jobId },
            cancellationToken);

        if (affectedRows == 0)
        {
            var existingJob = await _dbContext.AIProcessingJobs.AsNoTracking().FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);
            if (existingJob == null)
            {
                throw new KeyNotFoundException($"AI Processing Job {jobId} not found.");
            }

            if (existingJob.Status == "COMPLETED")
            {
                _logger.LogInformation("Job {JobId} is already COMPLETED. Duplicate task delivery handled as safe no-op.", jobId);
                return;
            }

            _logger.LogWarning("Job {JobId} is in status {Status}. Atomic acquisition skipped.", jobId, existingJob.Status);
            return;
        }

        // 2. Load authoritative entity graph from PostgreSQL
        var job = await _dbContext.AIProcessingJobs.FirstOrDefaultAsync(j => j.Id == jobId, cancellationToken);
        if (job == null)
        {
            throw new KeyNotFoundException($"AI Processing Job {jobId} not found.");
        }

        var capture = await _dbContext.InventoryCaptures
            .Include(c => c.ImageAsset)
            .FirstOrDefaultAsync(c => c.Id == job.CaptureId, cancellationToken);

        if (capture == null || capture.ImageAsset == null)
        {
            job.Status = "FAILED";
            job.LastError = "Associated capture or image asset not found.";
            job.UpdatedAt = DateTimeOffset.UtcNow;
            if (capture != null)
            {
                capture.Status = "FAILED";
                capture.UpdatedAt = DateTimeOffset.UtcNow;
            }
            await _dbContext.SaveChangesAsync(cancellationToken);
            return;
        }

        try
        {
            // Fetch private image stream via storage abstraction
            using var imageStream = await _storage.OpenReadObjectAsync(capture.ImageAsset.ObjectPath, cancellationToken);

            // Invoke vision provider
            var suggestions = await _visionProvider.AnalyzeImageAsync(
                imageStream,
                capture.ImageAsset.ContentType,
                cancellationToken);

            // Atomic database transaction for persistence and status update
            using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                foreach (var dto in suggestions)
                {
                    var suggestion = new DetectionSuggestion
                    {
                        Id = Guid.NewGuid(),
                        WorkspaceId = capture.WorkspaceId,
                        CaptureId = capture.Id,
                        Name = dto.Name,
                        Quantity = dto.Quantity,
                        Confidence = dto.Confidence,
                        IsRemoved = false,
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };
                    _dbContext.DetectionSuggestions.Add(suggestion);
                }

                capture.Status = "REVIEW_REQUIRED";
                capture.UpdatedAt = DateTimeOffset.UtcNow;

                job.Status = "COMPLETED";
                job.UpdatedAt = DateTimeOffset.UtcNow;

                await _dbContext.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);

                _logger.LogInformation("Job {JobId} completed successfully with {Count} suggestions.", jobId, suggestions.Count);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync(cancellationToken);
                _logger.LogError(ex, "Transaction failed while persisting suggestions for job {JobId}.", jobId);

                job.Status = "FAILED";
                job.LastError = "AI persistence transaction failed.";
                job.UpdatedAt = DateTimeOffset.UtcNow;

                capture.Status = "FAILED";
                capture.UpdatedAt = DateTimeOffset.UtcNow;

                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Processing failed for job {JobId}.", jobId);
            job.Status = "FAILED";
            job.LastError = "Job processing failed.";
            job.UpdatedAt = DateTimeOffset.UtcNow;

            capture.Status = "FAILED";
            capture.UpdatedAt = DateTimeOffset.UtcNow;

            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
