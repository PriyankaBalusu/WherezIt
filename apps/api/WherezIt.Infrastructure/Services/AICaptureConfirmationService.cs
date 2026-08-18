using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using WherezIt.Application.AI.Dtos;
using WherezIt.Application.AI.Services;
using WherezIt.Application.Authentication;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class AICaptureConfirmationService : IAICaptureConfirmationService
{
    private readonly WherezItDbContext _dbContext;
    private readonly IWorkspaceAuthorizationService _authorizationService;

    public AICaptureConfirmationService(
        WherezItDbContext dbContext,
        IWorkspaceAuthorizationService authorizationService)
    {
        _dbContext = dbContext;
        _authorizationService = authorizationService;
    }

    public async Task<ConfirmCaptureResponseDto> ConfirmCaptureAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid captureId,
        ConfirmCaptureRequestDto request,
        CancellationToken cancellationToken = default)
    {
        await _authorizationService.RequireWorkspaceMembershipAsync(identity, workspaceId, cancellationToken);

        // Pre-transaction validation
        if (request == null || request.Items == null || request.Items.Count == 0)
        {
            throw new ArgumentException("At least one confirmed item is required.");
        }

        if (request.Items.Count > 50)
        {
            throw new ArgumentException("Cannot confirm more than 50 items in a single capture.");
        }

        foreach (var item in request.Items)
        {
            var trimmedName = item.Name?.Trim();
            if (string.IsNullOrWhiteSpace(trimmedName))
            {
                throw new ArgumentException("Item name cannot be empty.");
            }

            if (trimmedName.Length > 200)
            {
                throw new ArgumentException("Item name cannot exceed 200 characters.");
            }

            if (item.Quantity < 1)
            {
                throw new ArgumentException("Item quantity must be at least 1.");
            }
        }

        // Execute in single atomic database transaction
        using var transaction = await _dbContext.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // Conditional atomic acquisition: REVIEW_REQUIRED -> CONFIRMED
            var affectedRows = await _dbContext.Database.ExecuteSqlRawAsync(
                "UPDATE inventory_captures SET status = 'CONFIRMED', updated_at = NOW() WHERE id = {0} AND workspace_id = {1} AND status = 'REVIEW_REQUIRED';",
                new object[] { captureId, workspaceId },
                cancellationToken);

            if (affectedRows != 1)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new InvalidOperationException("Capture is not eligible for confirmation or already confirmed.");
            }

            var capture = await _dbContext.InventoryCaptures
                .Include(c => c.Container)
                .FirstOrDefaultAsync(c => c.Id == captureId && c.WorkspaceId == workspaceId, cancellationToken);

            if (capture == null || capture.Container == null || capture.Container.WorkspaceId != workspaceId)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new KeyNotFoundException("Capture or container context was invalid.");
            }

            // Create trusted Item rows
            var createdItems = new List<Item>();
            var now = DateTimeOffset.UtcNow;

            foreach (var itemDto in request.Items)
            {
                var newItem = new Item
                {
                    Id = Guid.NewGuid(),
                    WorkspaceId = workspaceId,
                    ContainerId = capture.ContainerId,
                    Name = itemDto.Name.Trim(),
                    Quantity = itemDto.Quantity,
                    Source = "AI_CONFIRMED",
                    IsVerified = true,
                    IsArchived = false,
                    CreatedAt = now,
                    UpdatedAt = now
                };

                _dbContext.Items.Add(newItem);
                createdItems.Add(newItem);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return new ConfirmCaptureResponseDto
            {
                CaptureId = capture.Id,
                WorkspaceId = capture.WorkspaceId,
                ContainerId = capture.ContainerId,
                Status = "CONFIRMED",
                ConfirmedItemsCount = createdItems.Count
            };
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }
}
