using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Seed.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Users.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Seed;

public class Bug4SeedService : IBug4SeedService
{
    public const string SEED_PREFIX = "BUG4-SEED-";

    private readonly IHostEnvironment _environment;
    private readonly WherezItDbContext _dbContext;
    private readonly IUserService _userService;
    private readonly IWorkspaceService _workspaceService;
    private readonly IStorageLocationService _locationService;
    private readonly IContainerService _containerService;
    private readonly ILogger<Bug4SeedService> _logger;

    public Bug4SeedService(
        IHostEnvironment environment,
        WherezItDbContext dbContext,
        IUserService userService,
        IWorkspaceService workspaceService,
        IStorageLocationService locationService,
        IContainerService containerService,
        ILogger<Bug4SeedService> logger)
    {
        _environment = environment;
        _dbContext = dbContext;
        _userService = userService;
        _workspaceService = workspaceService;
        _locationService = locationService;
        _containerService = containerService;
        _logger = logger;
    }

    public async Task<Bug4SeedResult> SeedBug4DataAsync(
        string firebaseUid,
        string userEmail,
        CancellationToken cancellationToken = default)
    {
        if (_environment.IsProduction())
        {
            throw new InvalidOperationException("Bug 4 preview seeding is strictly forbidden in Production environment.");
        }

        if (string.IsNullOrWhiteSpace(firebaseUid))
        {
            throw new ArgumentException("Firebase UID is required for seeding test data.", nameof(firebaseUid));
        }

        var identity = new AuthenticatedIdentity(firebaseUid, userEmail ?? $"{firebaseUid}@dev.wherezit", true);
        await _userService.SyncCurrentUserAsync(identity, cancellationToken);

        // Resolve or create workspace for user
        var userWorkspaces = await _workspaceService.GetUserWorkspacesAsync(identity, cancellationToken);
        var targetWs = userWorkspaces.FirstOrDefault();

        if (targetWs == null)
        {
            targetWs = await _workspaceService.CreateWorkspaceAsync(
                identity,
                new CreateWorkspaceRequestDto("Dev Test Space"),
                cancellationToken);
        }

        // Get existing locations or create needed locations
        var locations = await _locationService.GetLocationsAsync(identity, targetWs.Id, cancellationToken);

        var garage = locations.FirstOrDefault(l => string.Equals(l.Name, "Garage", StringComparison.OrdinalIgnoreCase));
        if (garage == null)
        {
            garage = await _locationService.CreateLocationAsync(identity, targetWs.Id, new CreateStorageLocationRequestDto("Garage", null), cancellationToken);
        }

        var kitchen = locations.FirstOrDefault(l => string.Equals(l.Name, "Kitchen", StringComparison.OrdinalIgnoreCase));
        if (kitchen == null)
        {
            kitchen = await _locationService.CreateLocationAsync(identity, targetWs.Id, new CreateStorageLocationRequestDto("Kitchen", null), cancellationToken);
        }

        var attic = locations.FirstOrDefault(l =>
            !string.Equals(l.Name, "Garage", StringComparison.OrdinalIgnoreCase) &&
            !string.Equals(l.Name, "Kitchen", StringComparison.OrdinalIgnoreCase));

        if (attic == null)
        {
            attic = await _locationService.CreateLocationAsync(identity, targetWs.Id, new CreateStorageLocationRequestDto("Attic", null), cancellationToken);
        }

        // Location Distribution:
        // Garage: 6 boxes (01-06)
        // Kitchen: 4 boxes (07-10)
        // Attic: 8 boxes (11-18)
        int createdCount = 0;
        int skippedCount = 0;

        for (int i = 1; i <= 18; i++)
        {
            string boxName = $"{SEED_PREFIX}{i:D2}";

            // Idempotency check: verify box with this seed marker doesn't already exist
            bool exists = await _dbContext.Containers
                .AsNoTracking()
                .AnyAsync(c => c.WorkspaceId == targetWs.Id && c.Name == boxName, cancellationToken);

            if (exists)
            {
                skippedCount++;
                continue;
            }

            Guid targetLocationId = i switch
            {
                <= 6 => garage.Id,
                <= 10 => kitchen.Id,
                _ => attic.Id,
            };

            await _containerService.CreateContainerAsync(
                identity,
                targetWs.Id,
                new CreateContainerRequestDto(
                    targetLocationId,
                    boxName,
                    $"Bug 4 Preview Test Container #{i:D2}"
                ),
                cancellationToken
            );

            createdCount++;
        }

        _logger.LogInformation("Bug 4 seed completed for workspace {WorkspaceId}: Created {Created}, Skipped {Skipped}.", targetWs.Id, createdCount, skippedCount);

        return new Bug4SeedResult(
            true,
            targetWs.Id.ToString(),
            targetWs.Name,
            createdCount,
            skippedCount,
            "Bug 4 preview seed completed successfully."
        );
    }

    public async Task<Bug4CleanupResult> CleanupBug4DataAsync(
        string firebaseUid,
        string userEmail,
        CancellationToken cancellationToken = default)
    {
        if (_environment.IsProduction())
        {
            throw new InvalidOperationException("Bug 4 seed cleanup is strictly forbidden in Production environment.");
        }

        if (string.IsNullOrWhiteSpace(firebaseUid))
        {
            throw new ArgumentException("Firebase UID is required for seed cleanup.", nameof(firebaseUid));
        }

        var identity = new AuthenticatedIdentity(firebaseUid, userEmail ?? $"{firebaseUid}@dev.wherezit", true);
        var userWorkspaces = await _workspaceService.GetUserWorkspacesAsync(identity, cancellationToken);
        var targetWs = userWorkspaces.FirstOrDefault();

        if (targetWs == null)
        {
            return new Bug4CleanupResult(true, "N/A", 0, "No workspace found for user. Nothing to clean up.");
        }

        var seedBoxes = await _dbContext.Containers
            .Where(c => c.WorkspaceId == targetWs.Id && c.Name != null && (c.Name.StartsWith(SEED_PREFIX) || c.Name.StartsWith("BUG4 Test Box")))
            .ToListAsync(cancellationToken);

        if (seedBoxes.Count == 0)
        {
            return new Bug4CleanupResult(true, targetWs.Id.ToString(), 0, "No Bug 4 seed boxes found. Nothing removed.");
        }

        var seedBoxIds = seedBoxes.Select(c => c.Id).ToList();

        // Clean up associated activity history and items for seed boxes
        var histories = await _dbContext.ActivityHistories
            .Where(h => h.ContainerId != Guid.Empty && seedBoxIds.Contains(h.ContainerId))
            .ToListAsync(cancellationToken);

        var items = await _dbContext.Items
            .Where(i => seedBoxIds.Contains(i.ContainerId))
            .ToListAsync(cancellationToken);

        _dbContext.ActivityHistories.RemoveRange(histories);
        _dbContext.Items.RemoveRange(items);
        _dbContext.Containers.RemoveRange(seedBoxes);

        await _dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Bug 4 seed cleanup removed {Count} containers from workspace {WorkspaceId}.", seedBoxes.Count, targetWs.Id);

        return new Bug4CleanupResult(
            true,
            targetWs.Id.ToString(),
            seedBoxes.Count,
            "Bug 4 seed cleanup completed successfully."
        );
    }
}
