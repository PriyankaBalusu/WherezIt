using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;
using WherezIt.Application.Seed.Services;
using WherezIt.Application.Storage.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Users.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Seed;

public class DemoDataSeedService : IDemoDataSeedService
{
    public const string SEED_MARKER = "[DEMO-SEED]";

    private readonly IHostEnvironment _environment;
    private readonly WherezItDbContext _dbContext;
    private readonly IUserService _userService;
    private readonly IWorkspaceService _workspaceService;
    private readonly IStorageLocationService _locationService;
    private readonly IContainerService _containerService;
    private readonly IItemService _itemService;
    private readonly IImageObjectStorage _storage;
    private readonly ILogger<DemoDataSeedService> _logger;

    public DemoDataSeedService(
        IHostEnvironment environment,
        WherezItDbContext dbContext,
        IUserService userService,
        IWorkspaceService workspaceService,
        IStorageLocationService locationService,
        IContainerService containerService,
        IItemService itemService,
        IImageObjectStorage storage,
        ILogger<DemoDataSeedService> logger)
    {
        _environment = environment;
        _dbContext = dbContext;
        _userService = userService;
        _workspaceService = workspaceService;
        _locationService = locationService;
        _containerService = containerService;
        _itemService = itemService;
        _storage = storage;
        _logger = logger;
    }

    private bool IsSeedingAllowed()
    {
        if (_environment.IsDevelopment())
        {
            return true;
        }

        var allowEnv = Environment.GetEnvironmentVariable("WHEREZIT_ALLOW_DEMO_SEED");
        return string.Equals(allowEnv, "true", StringComparison.OrdinalIgnoreCase);
    }

    public async Task<DemoSeedResult> SeedDemoDataAsync(
        string firebaseUid,
        string userEmail,
        CancellationToken cancellationToken = default)
    {
        if (!IsSeedingAllowed())
        {
            throw new InvalidOperationException("Demo data seeding is restricted to Development environment or requires WHEREZIT_ALLOW_DEMO_SEED=true.");
        }

        if (string.IsNullOrWhiteSpace(firebaseUid))
        {
            throw new ArgumentException("Firebase UID is required for seeding demo data.", nameof(firebaseUid));
        }

        var identity = new AuthenticatedIdentity(firebaseUid, userEmail ?? $"{firebaseUid}@demo.wherezit", true);
        await _userService.SyncCurrentUserAsync(identity, cancellationToken);

        // Check existing user workspaces for idempotency
        var existingWorkspaces = await _workspaceService.GetUserWorkspacesAsync(identity, cancellationToken);
        var existingDemoWorkspaces = existingWorkspaces
            .Where(w => w.Name.Contains(SEED_MARKER, StringComparison.OrdinalIgnoreCase))
            .ToList();

        if (existingDemoWorkspaces.Count >= 4)
        {
            _logger.LogInformation("Demo data seeder: All 4 demo workspaces already exist for user {Uid}. Skipping creation.", firebaseUid);
            return new DemoSeedResult(
                Success: true,
                WorkspacesCreated: 0,
                WorkspacesSkipped: existingDemoWorkspaces.Count,
                LocationsCreated: 0,
                BoxesCreated: 0,
                ItemsCreated: 0,
                ReferencePhotosCreated: 0,
                ReferencePhotosSkipped: 0,
                ItemPhotosCreated: 0,
                ItemPhotosSkipped: 0,
                RepresentativeActivityEvents: 0,
                PackedBoxes: 0,
                OpenFirstBoxes: 0,
                TemporaryLocationBoxes: 0,
                Errors: 0,
                ResolvedImageDirectory: ResolveSeedImagesDirectory(),
                Message: "Demo workspaces already exist. Idempotent skip performed."
            );
        }

        var rand = new Random(42); // Fixed seed for deterministic data generation

        int totalLocationsCreated = 0;
        int totalBoxesCreated = 0;
        int totalItemsCreated = 0;
        int totalRefCreated = 0;
        int totalRefSkipped = 0;
        int totalItemPhotosCreated = 0;
        int totalItemPhotosSkipped = 0;
        int totalActivityEvents = 0;
        int totalPacked = 0;
        int totalOpenFirst = 0;
        int totalTempLocation = 0;
        int workspacesCreated = 0;
        int workspacesSkipped = 0;

        // Definition of 4 Demo Storage Spaces
        var demoSpaceDefs = new[]
        {
            new DemoSpaceConfig("Demo Home " + SEED_MARKER, 50, 300, IsMovingSpace: false),
            new DemoSpaceConfig("Demo Storage Unit " + SEED_MARKER, 35, 200, IsMovingSpace: false),
            new DemoSpaceConfig("Demo Family House " + SEED_MARKER, 25, 135, IsMovingSpace: false),
            new DemoSpaceConfig("Demo Moving " + SEED_MARKER, 25, 120, IsMovingSpace: true)
        };

        foreach (var spaceConfig in demoSpaceDefs)
        {
            Guid workspaceId;
            List<StorageLocationResponseDto> locationList;
            List<ContainerResponseDto> boxes;

            var existingWs = existingDemoWorkspaces.FirstOrDefault(w => string.Equals(w.Name, spaceConfig.Name, StringComparison.OrdinalIgnoreCase));
            if (existingWs != null)
            {
                var existingItemCount = await _dbContext.Items.CountAsync(i => i.WorkspaceId == existingWs.Id, cancellationToken);
                if (existingItemCount >= spaceConfig.TargetItemCount - 10)
                {
                    workspacesSkipped++;
                    continue;
                }

                // Partial run recovery: reuse existing workspace, locations, and boxes
                workspaceId = existingWs.Id;
                var existingLocs = await _locationService.GetLocationsAsync(identity, workspaceId, cancellationToken);
                var existingBoxes = await _containerService.GetContainersAsync(identity, workspaceId, cancellationToken: cancellationToken);

                if (!existingLocs.Any())
                {
                    var locationMap = await BuildLocationHierarchyAsync(identity, workspaceId, spaceConfig.Name, cancellationToken);
                    locationList = locationMap.Values.ToList();
                    totalLocationsCreated += locationList.Count;
                }
                else
                {
                    locationList = existingLocs.ToList();
                }

                if (!existingBoxes.Any())
                {
                    var (createdBoxes, packed, openFirst, tempLoc) = await SeedBoxesForWorkspaceAsync(
                        identity,
                        workspaceId,
                        spaceConfig,
                        locationList,
                        rand,
                        cancellationToken);

                    boxes = createdBoxes;
                    totalBoxesCreated += boxes.Count;
                    totalPacked += packed;
                    totalOpenFirst += openFirst;
                    totalTempLocation += tempLoc;
                }
                else
                {
                    boxes = existingBoxes.ToList();
                }

                int remainingItemsToSeed = Math.Max(0, spaceConfig.TargetItemCount - existingItemCount);
                if (remainingItemsToSeed > 0)
                {
                    int bulkItemCount = await BulkSeedItemsForBoxesAsync(
                        workspaceId,
                        boxes,
                        remainingItemsToSeed,
                        rand,
                        cancellationToken);
                    totalItemsCreated += bulkItemCount;
                }

                workspacesCreated++;
                continue;
            }

            // 1. Create Workspace using Application Service
            var ws = await _workspaceService.CreateWorkspaceAsync(
                identity,
                new CreateWorkspaceRequestDto(spaceConfig.Name),
                cancellationToken);
            workspacesCreated++;
            workspaceId = ws.Id;

            // 2. Create Location Hierarchy
            var newLocationMap = await BuildLocationHierarchyAsync(identity, workspaceId, spaceConfig.Name, cancellationToken);
            totalLocationsCreated += newLocationMap.Count;
            locationList = newLocationMap.Values.ToList();

            // 3. Create Boxes using Application Service (allocates box numbers via active InventoryNamespace)
            var (newBoxes, newPacked, newOpenFirst, newTempLoc) = await SeedBoxesForWorkspaceAsync(
                identity,
                workspaceId,
                spaceConfig,
                locationList,
                rand,
                cancellationToken);

            boxes = newBoxes;
            totalBoxesCreated += boxes.Count;
            totalPacked += newPacked;
            totalOpenFirst += newOpenFirst;
            totalTempLocation += newTempLoc;

            // 4. Seed Representative Items through ItemService (naturally generates ITEM_ADDED ActivityHistory)
            int representativeItemCount = await SeedRepresentativeItemsAsync(identity, workspaceId, boxes, cancellationToken);
            totalItemsCreated += representativeItemCount;
            totalActivityEvents += representativeItemCount;

            // 5. Bulk Create Remaining Items using Direct EF Core for performance
            int createdBulkItemCount = await BulkSeedItemsForBoxesAsync(
                workspaceId,
                boxes,
                spaceConfig.TargetItemCount - representativeItemCount,
                rand,
                cancellationToken);
            totalItemsCreated += createdBulkItemCount;

            // 6. Seed Box Reference & Item Photos ONLY if source image binaries exist on disk
            var imageResult = await SeedVerifiedImagesAsync(
                identity,
                workspaceId,
                boxes,
                cancellationToken);

            totalRefCreated += imageResult.RefCreated;
            totalRefSkipped += imageResult.RefSkipped;
            totalItemPhotosCreated += imageResult.ItemPhotosCreated;
            totalItemPhotosSkipped += imageResult.ItemPhotosSkipped;
            totalActivityEvents += imageResult.RefCreated + imageResult.ItemPhotosCreated;
        }

        return new DemoSeedResult(
            Success: true,
            WorkspacesCreated: workspacesCreated,
            WorkspacesSkipped: workspacesSkipped,
            LocationsCreated: totalLocationsCreated,
            BoxesCreated: totalBoxesCreated,
            ItemsCreated: totalItemsCreated,
            ReferencePhotosCreated: totalRefCreated,
            ReferencePhotosSkipped: totalRefSkipped,
            ItemPhotosCreated: totalItemPhotosCreated,
            ItemPhotosSkipped: totalItemPhotosSkipped,
            RepresentativeActivityEvents: totalActivityEvents,
            PackedBoxes: totalPacked,
            OpenFirstBoxes: totalOpenFirst,
            TemporaryLocationBoxes: totalTempLocation,
            Errors: 0,
            ResolvedImageDirectory: ResolveSeedImagesDirectory(),
            Message: $"Successfully seeded {workspacesCreated} Storage Spaces, {totalLocationsCreated} Locations, {totalBoxesCreated} Boxes, and {totalItemsCreated} Items."
        );
    }

    private async Task<Dictionary<string, StorageLocationResponseDto>> BuildLocationHierarchyAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        string workspaceName,
        CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, StorageLocationResponseDto>();

        if (workspaceName.Contains("Demo Home"))
        {
            var roots = new[] { "Garage", "Kitchen", "Master Bedroom", "Office", "Living Room", "Closet", "Attic", "Basement" };
            foreach (var rootName in roots)
            {
                var rootLoc = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto(rootName, null), cancellationToken);
                result[rootName] = rootLoc;

                if (rootName == "Garage")
                {
                    var l1 = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Left Shelving", rootLoc.Id), cancellationToken);
                    var l2 = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Right Shelving", rootLoc.Id), cancellationToken);
                    var l3 = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Tool Cabinet", rootLoc.Id), cancellationToken);
                    result["Garage/Left Shelving"] = l1;
                    result["Garage/Right Shelving"] = l2;
                    result["Garage/Tool Cabinet"] = l3;
                }
                else if (rootName == "Kitchen")
                {
                    var k1 = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Pantry", rootLoc.Id), cancellationToken);
                    var k2 = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Upper Cabinets", rootLoc.Id), cancellationToken);
                    var k3 = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Lower Cabinets", rootLoc.Id), cancellationToken);
                    result["Kitchen/Pantry"] = k1;
                    result["Kitchen/Upper Cabinets"] = k2;
                    result["Kitchen/Lower Cabinets"] = k3;
                }
                else if (rootName == "Master Bedroom")
                {
                    var b1 = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Closet", rootLoc.Id), cancellationToken);
                    result["Master Bedroom/Closet"] = b1;

                    var b1a = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Top Shelf", b1.Id), cancellationToken);
                    var b1b = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Hanging Section", b1.Id), cancellationToken);
                    result["Master Bedroom/Closet/Top Shelf"] = b1a;
                    result["Master Bedroom/Closet/Hanging Section"] = b1b;
                }
            }
        }
        else if (workspaceName.Contains("Demo Storage Unit"))
        {
            var roots = new[] { "Row A", "Row B", "Back Wall", "Front Left Stack", "Front Right Stack" };
            foreach (var rootName in roots)
            {
                var rootLoc = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto(rootName, null), cancellationToken);
                result[rootName] = rootLoc;

                if (rootName == "Row A")
                {
                    var s1 = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Shelf A1", rootLoc.Id), cancellationToken);
                    var s2 = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Shelf A2", rootLoc.Id), cancellationToken);
                    result["Row A/Shelf A1"] = s1;
                    result["Row A/Shelf A2"] = s2;
                }
                else if (rootName == "Row B")
                {
                    var s3 = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto("Shelf B1", rootLoc.Id), cancellationToken);
                    result["Row B/Shelf B1"] = s3;
                }
            }
        }
        else
        {
            // Default roots for Family House and Moving Space
            var roots = new[] { "Staging Area", "Room 101", "Storage Rack", "Main Closet" };
            foreach (var rootName in roots)
            {
                var rootLoc = await _locationService.CreateLocationAsync(identity, workspaceId, new CreateStorageLocationRequestDto(rootName, null), cancellationToken);
                result[rootName] = rootLoc;
            }
        }

        return result;
    }

    private async Task<(List<ContainerResponseDto> Boxes, int Packed, int OpenFirst, int TempLocation)> SeedBoxesForWorkspaceAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        DemoSpaceConfig config,
        List<StorageLocationResponseDto> locations,
        Random rand,
        CancellationToken cancellationToken)
    {
        var boxNames = new[]
        {
            "Winter Clothes", "Kitchen Appliances", "Documents & Papers", "Holiday Decorations",
            "Kids Toys", "Books & Magazines", "Electronics & Cables", "Tools & Hardware",
            "Camping Gear", "Bedding & Linens", "Shoes & Boots", "Office Supplies",
            "Keepsakes & Photos", "Craft Supplies", "Pots & Pans", "Board Games"
        };

        var boxes = new List<ContainerResponseDto>();
        int packedCount = 0;
        int openFirstCount = 0;
        int tempLocCount = 0;

        for (int i = 0; i < config.TargetBoxCount; i++)
        {
            var loc = locations[i % locations.Count];
            var boxName = $"{boxNames[i % boxNames.Length]} #{i + 1}";

            var createReq = new CreateContainerRequestDto(
                Name: boxName,
                StorageNodeId: loc.Id,
                Description: $"Demo seed box record {SEED_MARKER}"
            );

            var box = await _containerService.CreateContainerAsync(identity, workspaceId, createReq, cancellationToken);
            boxes.Add(box);

            // Apply moving state parameters if moving space
            if (config.IsMovingSpace)
            {
                bool isPacked = i % 2 == 0;
                string? priority = (i % 3 == 0) ? "HIGH" : (i % 3 == 1) ? "MEDIUM" : "LOW";

                var updateReq = new UpdateContainerRequestDto(
                    Name: box.Name,
                    Description: box.Description,
                    DestinationStorageNodeId: isPacked ? locations[(i + 1) % locations.Count].Id : null,
                    IsPacked: isPacked,
                    MovingPriority: priority
                );

                await _containerService.UpdateContainerAsync(identity, workspaceId, box.Id, updateReq, cancellationToken);

                if (isPacked) packedCount++;
                if (priority == "HIGH") openFirstCount++;
            }
        }

        return (boxes, packedCount, openFirstCount, tempLocCount);
    }

    private async Task<int> SeedRepresentativeItemsAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        List<ContainerResponseDto> boxes,
        CancellationToken cancellationToken)
    {
        if (boxes.Count == 0) return 0;

        int created = 0;
        // Create 2 representative items per workspace using ItemService to trigger ITEM_ADDED ActivityHistory
        var targetBoxes = boxes.Take(2).ToList();
        foreach (var box in targetBoxes)
        {
            var req = new CreateItemRequestDto(
                Name: $"Representative Feature Item #{created + 1}",
                Quantity: 1,
                Category: "Household"
            );

            await _itemService.CreateItemAsync(identity, workspaceId, box.Id, req, cancellationToken);
            created++;
        }

        return created;
    }

    private async Task<int> BulkSeedItemsForBoxesAsync(
        Guid workspaceId,
        List<ContainerResponseDto> boxes,
        int targetTotalItems,
        Random rand,
        CancellationToken cancellationToken)
    {
        var itemSampleNames = new[]
        {
            "Heavy Duty Blender", "Stainless Steel Mixing Bowls", "High Speed Router",
            "Power Strip 6-Outlet", "Leather Winter Gloves", "Wool Knit Sweater",
            "Screwdriver Set 12-Piece", "Cordless Power Drill", "Hardcover Novel Collection",
            "Board Game Set", "LED Flashlight", "Microfiber Towels (Pack of 4)",
            "Ceramic Coffee Mugs", "USB-C Charging Cables", "Camping Lantern"
        };

        var categories = new[] { "Kitchen", "Electronics", "Clothing", "Tools", "Books", "Household" };

        var itemsToInsert = new List<Item>();
        int itemsPerBox = Math.Max(2, targetTotalItems / Math.Max(1, boxes.Count));

        foreach (var box in boxes)
        {
            int countForThisBox = rand.Next(itemsPerBox - 1, itemsPerBox + 3);
            for (int k = 0; k < countForThisBox; k++)
            {
                var itemId = Guid.NewGuid();
                var itemName = itemSampleNames[rand.Next(itemSampleNames.Length)];
                var category = categories[rand.Next(categories.Length)];

                var item = new Item
                {
                    Id = itemId,
                    WorkspaceId = workspaceId,
                    ContainerId = box.Id,
                    Name = itemName,
                    Quantity = rand.Next(1, 4),
                    Category = category,
                    Source = "MANUAL",
                    IsVerified = true,
                    IsArchived = false,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                };

                itemsToInsert.Add(item);
            }
        }

        if (itemsToInsert.Count > 0)
        {
            await _dbContext.Items.AddRangeAsync(itemsToInsert, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return itemsToInsert.Count;
    }

    private string ResolveSeedImagesDirectory()
    {
        // 1. Try repository root relative to API ContentRootPath (apps/api/WherezIt.Api -> ../../..)
        var repoRootCandidate = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, "..", "..", "..", "seed-assets", "demo-images"));
        if (Directory.Exists(repoRootCandidate))
        {
            return repoRootCandidate;
        }

        // 2. Try current working directory seed-assets/demo-images
        var cwdCandidate = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "seed-assets", "demo-images"));
        if (Directory.Exists(cwdCandidate))
        {
            return cwdCandidate;
        }

        // Default to deterministic repository root path
        return repoRootCandidate;
    }

    private async Task<(int RefCreated, int RefSkipped, int ItemPhotosCreated, int ItemPhotosSkipped)> SeedVerifiedImagesAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        List<ContainerResponseDto> boxes,
        CancellationToken cancellationToken)
    {
        int refCreated = 0;
        int refSkipped = 0;
        int itemPhotosCreated = 0;
        int itemPhotosSkipped = 0;

        string baseSeedDir = ResolveSeedImagesDirectory();

        for (int i = 0; i < boxes.Count; i++)
        {
            if (i % 3 == 0) // Attempt reference photo on 1 in 3 boxes
            {
                var box = boxes[i];
                string refFileName = $"box-ref-{(i % 10) + 1}.jpg";
                string refFilePath = Path.Combine(baseSeedDir, refFileName);

                if (File.Exists(refFilePath))
                {
                    using var stream = File.OpenRead(refFilePath);
                    var objectPath = _storage.CreateObjectPath(workspaceId, "jpg");
                    await _storage.UploadObjectAsync(objectPath, stream, "image/jpeg", cancellationToken);

                    var asset = new ImageAsset
                    {
                        Id = Guid.NewGuid(),
                        WorkspaceId = workspaceId,
                        ContainerId = box.Id,
                        ItemId = null,
                        ObjectPath = objectPath,
                        ContentType = "image/jpeg",
                        SizeBytes = new FileInfo(refFilePath).Length,
                        Status = "READY",
                        ImagePurpose = "REFERENCE",
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };

                    _dbContext.ImageAssets.Add(asset);
                    _dbContext.ActivityHistories.Add(new ActivityHistory
                    {
                        Id = Guid.NewGuid(),
                        WorkspaceId = workspaceId,
                        ActorUserId = identity.FirebaseUid,
                        ActivityType = "PHOTO_ADDED",
                        ContainerId = box.Id,
                        PreviousLocationDisplay = string.Empty,
                        DestinationLocationDisplay = string.Empty,
                        OccurredAt = DateTimeOffset.UtcNow
                    });

                    refCreated++;
                }
                else
                {
                    refSkipped++;
                }
            }
        }

        // Seed Item Photos for candidate items in workspace
        var workspaceItems = await _dbContext.Items
            .Where(i => i.WorkspaceId == workspaceId)
            .OrderBy(i => i.CreatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        for (int j = 0; j < workspaceItems.Count; j++)
        {
            if (j % 5 == 0) // Attempt item photo on 1 in 5 items
            {
                var item = workspaceItems[j];
                string itemFileName = $"item-photo-{(itemPhotosCreated % 10) + 1}.jpg";
                string itemFilePath = Path.Combine(baseSeedDir, itemFileName);

                if (File.Exists(itemFilePath))
                {
                    using var stream = File.OpenRead(itemFilePath);
                    var objectPath = _storage.CreateObjectPath(workspaceId, "jpg");
                    await _storage.UploadObjectAsync(objectPath, stream, "image/jpeg", cancellationToken);

                    var asset = new ImageAsset
                    {
                        Id = Guid.NewGuid(),
                        WorkspaceId = workspaceId,
                        ContainerId = item.ContainerId,
                        ItemId = item.Id,
                        ObjectPath = objectPath,
                        ContentType = "image/jpeg",
                        SizeBytes = new FileInfo(itemFilePath).Length,
                        Status = "READY",
                        ImagePurpose = "ITEM",
                        CreatedAt = DateTimeOffset.UtcNow,
                        UpdatedAt = DateTimeOffset.UtcNow
                    };

                    _dbContext.ImageAssets.Add(asset);
                    _dbContext.ActivityHistories.Add(new ActivityHistory
                    {
                        Id = Guid.NewGuid(),
                        WorkspaceId = workspaceId,
                        ActorUserId = identity.FirebaseUid,
                        ActivityType = "PHOTO_ADDED",
                        ContainerId = item.ContainerId,
                        PreviousLocationDisplay = string.Empty,
                        DestinationLocationDisplay = string.Empty,
                        OccurredAt = DateTimeOffset.UtcNow
                    });

                    itemPhotosCreated++;
                }
                else
                {
                    itemPhotosSkipped++;
                }
            }
        }

        if (refCreated > 0 || itemPhotosCreated > 0)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return (refCreated, refSkipped, itemPhotosCreated, itemPhotosSkipped);
    }

    public async Task<DemoCleanupResult> CleanupDemoDataAsync(
        string firebaseUid,
        CancellationToken cancellationToken = default)
    {
        if (!IsSeedingAllowed())
        {
            throw new InvalidOperationException("Demo data cleanup is restricted to Development environment or requires WHEREZIT_ALLOW_DEMO_SEED=true.");
        }

        if (string.IsNullOrWhiteSpace(firebaseUid))
        {
            throw new ArgumentException("Firebase UID is required for demo data cleanup.", nameof(firebaseUid));
        }

        var user = await _dbContext.Users.FirstOrDefaultAsync(u => u.FirebaseUid == firebaseUid, cancellationToken);
        if (user == null)
        {
            return new DemoCleanupResult(
                Success: true,
                WorkspacesRemoved: 0,
                LocationsRemoved: 0,
                BoxesRemoved: 0,
                ItemsRemoved: 0,
                ImageAssetsRemoved: 0,
                Message: "User not found for demo cleanup."
            );
        }

        // Find demo workspaces matching SEED_MARKER for user
        var demoWorkspaces = await _dbContext.Workspaces
            .Include(w => w.Members)
            .Where(w => w.Name.Contains(SEED_MARKER) && w.Members.Any(m => m.UserId == user.Id))
            .ToListAsync(cancellationToken);

        if (demoWorkspaces.Count == 0)
        {
            return new DemoCleanupResult(
                Success: true,
                WorkspacesRemoved: 0,
                LocationsRemoved: 0,
                BoxesRemoved: 0,
                ItemsRemoved: 0,
                ImageAssetsRemoved: 0,
                Message: "No demo seed workspaces found for cleanup."
            );
        }

        int wsRemoved = 0;
        int locsRemoved = 0;
        int boxesRemoved = 0;
        int itemsRemoved = 0;
        int imagesRemoved = 0;

        foreach (var ws in demoWorkspaces)
        {
            var wsId = ws.Id;

            var items = await _dbContext.Items.Where(i => i.WorkspaceId == wsId).ToListAsync(cancellationToken);
            itemsRemoved += items.Count;
            _dbContext.Items.RemoveRange(items);

            var images = await _dbContext.ImageAssets.Where(i => i.WorkspaceId == wsId).ToListAsync(cancellationToken);
            imagesRemoved += images.Count;

            // Remove backing storage objects cleanly
            foreach (var img in images)
            {
                if (!string.IsNullOrEmpty(img.ObjectPath))
                {
                    try
                    {
                        await _storage.DeleteObjectAsync(img.ObjectPath, cancellationToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to delete storage object {ObjectPath} during demo cleanup.", img.ObjectPath);
                    }
                }
            }

            _dbContext.ImageAssets.RemoveRange(images);

            var containers = await _dbContext.Containers.Where(c => c.WorkspaceId == wsId).ToListAsync(cancellationToken);
            boxesRemoved += containers.Count;
            _dbContext.Containers.RemoveRange(containers);

            var locations = await _dbContext.StorageNodes.Where(l => l.WorkspaceId == wsId).ToListAsync(cancellationToken);
            locsRemoved += locations.Count;
            _dbContext.StorageNodes.RemoveRange(locations);

            var audits = await _dbContext.WorkspaceAudits.Where(a => a.WorkspaceId == wsId).ToListAsync(cancellationToken);
            _dbContext.WorkspaceAudits.RemoveRange(audits);

            var activityLogs = await _dbContext.ActivityHistories.Where(a => a.WorkspaceId == wsId).ToListAsync(cancellationToken);
            _dbContext.ActivityHistories.RemoveRange(activityLogs);

            _dbContext.Workspaces.Remove(ws);
            wsRemoved++;
        }

        await _dbContext.SaveChangesAsync(cancellationToken);

        return new DemoCleanupResult(
            Success: true,
            WorkspacesRemoved: wsRemoved,
            LocationsRemoved: locsRemoved,
            BoxesRemoved: boxesRemoved,
            ItemsRemoved: itemsRemoved,
            ImageAssetsRemoved: imagesRemoved,
            Message: $"Demo cleanup complete: Removed {wsRemoved} Storage Spaces, {locsRemoved} Locations, {boxesRemoved} Boxes, {itemsRemoved} Items, and {imagesRemoved} ImageAssets."
        );
    }
}

public record DemoSpaceConfig(
    string Name,
    int TargetBoxCount,
    int TargetItemCount,
    bool IsMovingSpace
);
