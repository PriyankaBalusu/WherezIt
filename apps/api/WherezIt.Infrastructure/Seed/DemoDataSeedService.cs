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
using WherezIt.Application.Identifiers.Services;
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
    private readonly IIdentifierService? _identifierService;
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
        : this(environment, dbContext, userService, workspaceService, locationService, containerService, itemService, storage, null, logger)
    {
    }

    public DemoDataSeedService(
        IHostEnvironment environment,
        WherezItDbContext dbContext,
        IUserService userService,
        IWorkspaceService workspaceService,
        IStorageLocationService locationService,
        IContainerService containerService,
        IItemService itemService,
        IImageObjectStorage storage,
        IIdentifierService? identifierService,
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
        _identifierService = identifierService;
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

        var workspaceDefs = GetDemoWorkspaceDefinitions();

        // Check existing user workspaces for idempotency
        var existingWorkspaces = await _workspaceService.GetUserWorkspacesAsync(identity, cancellationToken);
        var existingDemoWorkspaces = existingWorkspaces
            .Where(w => w.Name.Contains(SEED_MARKER, StringComparison.OrdinalIgnoreCase))
            .ToList();

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

        foreach (var wsDef in workspaceDefs)
        {
            Guid workspaceId;
            var existingWs = existingDemoWorkspaces.FirstOrDefault(w => string.Equals(w.Name, wsDef.Name, StringComparison.OrdinalIgnoreCase));

            if (existingWs != null)
            {
                workspaceId = existingWs.Id;
                workspacesSkipped++;
            }
            else
            {
                var ws = await _workspaceService.CreateWorkspaceAsync(
                    identity,
                    new CreateWorkspaceRequestDto(wsDef.Name),
                    cancellationToken);
                workspaceId = ws.Id;
                workspacesCreated++;
            }

            // Fetch existing locations for this workspace
            var existingLocsList = await _locationService.GetLocationsAsync(identity, workspaceId, cancellationToken);
            var locationMap = new Dictionary<string, StorageLocationResponseDto>(StringComparer.OrdinalIgnoreCase);

            MapExistingLocations(existingLocsList, locationMap);

            // Build missing locations idempotently
            foreach (var (path, parentPath) in wsDef.Locations)
            {
                if (locationMap.ContainsKey(path))
                {
                    continue;
                }

                Guid? parentId = null;
                if (!string.IsNullOrEmpty(parentPath) && locationMap.TryGetValue(parentPath, out var parentLoc))
                {
                    parentId = parentLoc.Id;
                }

                var locName = path.Contains('/') ? path.Split('/').Last() : path;
                var createdLoc = await _locationService.CreateLocationAsync(
                    identity,
                    workspaceId,
                    new CreateStorageLocationRequestDto(locName, parentId),
                    cancellationToken);

                locationMap[path] = createdLoc;
                totalLocationsCreated++;
            }

            // Fetch existing containers for this workspace
            var existingContainersList = await _containerService.GetContainersAsync(identity, workspaceId, cancellationToken: cancellationToken);
            var containerMap = new Dictionary<string, ContainerResponseDto>(StringComparer.OrdinalIgnoreCase);
            foreach (var c in existingContainersList)
            {
                if (!string.IsNullOrEmpty(c.Name))
                {
                    containerMap[c.Name] = c;
                }
            }
            var seededBoxesForWs = new List<ContainerResponseDto>();

            foreach (var boxDef in wsDef.Boxes)
            {
                if (!locationMap.TryGetValue(boxDef.LocationPath, out var targetLocation))
                {
                    _logger.LogWarning("Location path '{LocationPath}' not found when seeding box '{BoxName}'.", boxDef.LocationPath, boxDef.Name);
                    continue;
                }

                ContainerResponseDto boxDto;
                if (containerMap.TryGetValue(boxDef.Name, out var existingBox))
                {
                    boxDto = existingBox;
                }
                else
                {
                    var createReq = new CreateContainerRequestDto(
                        Name: boxDef.Name,
                        StorageNodeId: targetLocation.Id,
                        Description: boxDef.Description
                    );

                    boxDto = await _containerService.CreateContainerAsync(identity, workspaceId, createReq, cancellationToken);
                    if (!string.IsNullOrEmpty(boxDto.Name))
                    {
                        containerMap[boxDto.Name] = boxDto;
                    }
                    totalBoxesCreated++;
                }

                seededBoxesForWs.Add(boxDto);

                // Handle Moving State & Priorities
                Guid? destLocationId = null;
                if (!string.IsNullOrEmpty(boxDef.DestinationLocationPath) && locationMap.TryGetValue(boxDef.DestinationLocationPath, out var destLoc))
                {
                    destLocationId = destLoc.Id;
                }

                if (boxDef.IsPacked || boxDef.MovingPriority != null || destLocationId != null)
                {
                    var updateReq = new UpdateContainerRequestDto(
                        Name: boxDto.Name,
                        Description: boxDto.Description,
                        DestinationStorageNodeId: destLocationId,
                        IsPacked: boxDef.IsPacked,
                        MovingPriority: boxDef.MovingPriority
                    );

                    await _containerService.UpdateContainerAsync(identity, workspaceId, boxDto.Id, updateReq, cancellationToken);

                    if (boxDef.IsPacked) totalPacked++;
                    if (string.Equals(boxDef.MovingPriority, "HIGH", StringComparison.OrdinalIgnoreCase)) totalOpenFirst++;
                }

                // Seed Identifiers if supported by DI
                if (_identifierService != null)
                {
                    if (boxDef.SeedQr)
                    {
                        await _identifierService.GetOrCreateIdentifierAsync(identity, workspaceId, boxDto.Id, "QR", cancellationToken);
                    }
                    if (boxDef.SeedBarcode)
                    {
                        await _identifierService.GetOrCreateIdentifierAsync(identity, workspaceId, boxDto.Id, "BARCODE", cancellationToken);
                    }
                }

                // Seed Items for Box idempotently
                var existingItemsForBox = await _dbContext.Items
                    .Where(i => i.WorkspaceId == workspaceId && i.ContainerId == boxDto.Id)
                    .Select(i => i.Name)
                    .ToListAsync(cancellationToken);

                var existingItemNames = new HashSet<string>(existingItemsForBox, StringComparer.OrdinalIgnoreCase);

                foreach (var itemDef in boxDef.Items)
                {
                    if (existingItemNames.Contains(itemDef.Name))
                    {
                        continue;
                    }

                    var createItemReq = new CreateItemRequestDto(
                        Name: itemDef.Name,
                        Quantity: itemDef.Quantity,
                        Category: itemDef.Category
                    );

                    await _itemService.CreateItemAsync(identity, workspaceId, boxDto.Id, createItemReq, cancellationToken);
                    totalItemsCreated++;
                    totalActivityEvents++;
                    existingItemNames.Add(itemDef.Name);
                }
            }

            // Seed Box Reference & Item Photos ONLY if source image binaries exist on disk
            var imageResult = await SeedVerifiedImagesAsync(
                identity,
                workspaceId,
                seededBoxesForWs,
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

    private static void MapExistingLocations(
        IEnumerable<StorageLocationResponseDto> locations,
        Dictionary<string, StorageLocationResponseDto> map)
    {
        var locList = locations.ToList();
        var byId = locList.ToDictionary(l => l.Id);

        foreach (var loc in locList)
        {
            var pathParts = new List<string>();
            StorageLocationResponseDto? current = loc;
            while (current != null)
            {
                if (!string.IsNullOrEmpty(current.Name))
                {
                    pathParts.Insert(0, current.Name);
                }

                if (current.ParentId.HasValue && byId.TryGetValue(current.ParentId.Value, out var foundParent))
                {
                    current = foundParent;
                }
                else
                {
                    current = null;
                }
            }

            if (pathParts.Count > 0)
            {
                var fullPath = string.Join("/", pathParts);
                map[fullPath] = loc;
            }
        }
    }

    private string ResolveSeedImagesDirectory()
    {
        var repoRootCandidate = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, "..", "..", "..", "seed-assets", "demo-images"));
        if (Directory.Exists(repoRootCandidate))
        {
            return repoRootCandidate;
        }

        var cwdCandidate = Path.GetFullPath(Path.Combine(Directory.GetCurrentDirectory(), "seed-assets", "demo-images"));
        if (Directory.Exists(cwdCandidate))
        {
            return cwdCandidate;
        }

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
            var box = boxes[i];
            bool isPhotoCandidate = !string.IsNullOrEmpty(box.Name) && (
                                     box.Name.Contains("Camping", StringComparison.OrdinalIgnoreCase) ||
                                     box.Name.Contains("Baking", StringComparison.OrdinalIgnoreCase) ||
                                     box.Name.Contains("Linens", StringComparison.OrdinalIgnoreCase) ||
                                     box.Name.Contains("Christmas", StringComparison.OrdinalIgnoreCase) ||
                                     box.Name.Contains("Craft", StringComparison.OrdinalIgnoreCase) ||
                                     box.Name.Contains("Tools", StringComparison.OrdinalIgnoreCase) ||
                                     i % 3 == 0);

            if (isPhotoCandidate)
            {
                string refFileName = $"box-ref-{(i % 10) + 1}.jpg";
                string refFilePath = Path.Combine(baseSeedDir, refFileName);

                if (File.Exists(refFilePath))
                {
                    var existingAsset = await _dbContext.ImageAssets
                        .FirstOrDefaultAsync(a => a.WorkspaceId == workspaceId && a.ContainerId == box.Id && a.ImagePurpose == "REFERENCE", cancellationToken);

                    if (existingAsset == null)
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
                }
                else
                {
                    refSkipped++;
                }
            }
        }

        var workspaceItems = await _dbContext.Items
            .Where(i => i.WorkspaceId == workspaceId)
            .OrderBy(i => i.CreatedAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        for (int j = 0; j < workspaceItems.Count; j++)
        {
            if (j % 5 == 0)
            {
                var item = workspaceItems[j];
                string itemFileName = $"item-photo-{(itemPhotosCreated % 10) + 1}.jpg";
                string itemFilePath = Path.Combine(baseSeedDir, itemFileName);

                if (File.Exists(itemFilePath))
                {
                    var existingItemAsset = await _dbContext.ImageAssets
                        .FirstOrDefaultAsync(a => a.WorkspaceId == workspaceId && a.ItemId == item.Id, cancellationToken);

                    if (existingItemAsset == null)
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

    private static List<SeedWorkspaceDef> GetDemoWorkspaceDefinitions()
    {
        return new List<SeedWorkspaceDef>
        {
            // ==================================================
            // STORAGE SPACE 1: "Maple Grove Home" (19 Boxes)
            // ==================================================
            new SeedWorkspaceDef(
                Name: "Maple Grove Home " + SEED_MARKER,
                Locations: new List<(string Path, string? ParentPath)>
                {
                    ("Garage", null),
                    ("Garage/Rack A", "Garage"),
                    ("Garage/Rack B", "Garage"),
                    ("Garage/Workbench Cabinet", "Garage"),
                    ("Garage/Overhead Shelf", "Garage"),
                    ("Garage/Sports Corner", "Garage"),

                    ("Kitchen Pantry", null),
                    ("Kitchen Pantry/Baking Shelf", "Kitchen Pantry"),
                    ("Kitchen Pantry/Breakfast Shelf", "Kitchen Pantry"),
                    ("Kitchen Pantry/Snacks Shelf", "Kitchen Pantry"),
                    ("Kitchen Pantry/Bulk Storage", "Kitchen Pantry"),

                    ("Hall Closet", null),
                    ("Hall Closet/Upper Shelf", "Hall Closet"),
                    ("Hall Closet/Linen Shelf", "Hall Closet"),
                    ("Hall Closet/Floor Storage", "Hall Closet"),

                    ("Primary Bedroom Closet", null),
                    ("Primary Bedroom Closet/Top Shelf", "Primary Bedroom Closet"),
                    ("Primary Bedroom Closet/Shoe Rack", "Primary Bedroom Closet"),
                    ("Primary Bedroom Closet/Seasonal Clothing", "Primary Bedroom Closet")
                },
                Boxes: new List<SeedBoxDef>
                {
                    new SeedBoxDef(
                        Name: "Camping & Hiking Gear",
                        LocationPath: "Garage/Rack A",
                        Description: "Weekend camping equipment and outdoor essentials.",
                        SeedQr: true,
                        Items: new List<SeedItemDef>
                        {
                            new("4-person camping tent", 1, "Outdoor"),
                            new("Sleeping bag", 2, "Camping"),
                            new("Camping lantern", 2, "Emergency"),
                            new("LED flashlight", 3, "Emergency"),
                            new("Portable camping stove", 1, "Camping"),
                            new("First aid kit", 1, "Emergency"),
                            new("Paracord rope", 2, "Outdoor"),
                            new("Insect repellent", 2, "Camping"),
                            new("Camping chair", 2, "Camping")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Beach & Pool Gear",
                        LocationPath: "Garage/Rack A",
                        Description: "Summer beach towels, goggles, floats, and water gear.",
                        Items: new List<SeedItemDef>
                        {
                            new("Beach towel", 4, "Outdoor"),
                            new("Snorkel set", 2, "Outdoor"),
                            new("Swim goggles", 3, "Outdoor"),
                            new("Inflatable beach ball", 2, "Outdoor"),
                            new("Waterproof phone pouch", 2, "Outdoor"),
                            new("Sunscreen", 3, "Outdoor"),
                            new("Pool floats", 2, "Outdoor")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Car Care Supplies",
                        LocationPath: "Garage/Rack B",
                        Description: "Vehicle detailing products, tire gauge, and emergency jumper cables.",
                        Items: new List<SeedItemDef>
                        {
                            new("Microfiber cloths", 8, "Automotive"),
                            new("Tire pressure gauge", 1, "Automotive"),
                            new("Car wash soap", 2, "Automotive"),
                            new("Glass cleaner", 1, "Automotive"),
                            new("Interior detailing wipes", 2, "Automotive"),
                            new("Jumper cables", 1, "Automotive"),
                            new("Portable tire inflator", 1, "Automotive")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Garden Supplies",
                        LocationPath: "Garage/Rack B",
                        Description: "Hand tools, gloves, seed packets, and plant care items.",
                        Items: new List<SeedItemDef>
                        {
                            new("Gardening gloves", 3, "Garden"),
                            new("Hand trowel", 2, "Garden"),
                            new("Pruning shears", 1, "Garden"),
                            new("Plant ties", 2, "Garden"),
                            new("Seed packets", 12, "Garden"),
                            new("Watering nozzle", 1, "Garden"),
                            new("Kneeling pad", 1, "Garden")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Home Repair Tools",
                        LocationPath: "Garage/Workbench Cabinet",
                        Description: "Essential home maintenance tools, hammer, screwdrivers, and drill bits.",
                        SeedBarcode: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Claw hammer", 1, "Tools"),
                            new("Tape measure", 2, "Tools"),
                            new("Phillips screwdriver", 3, "Tools"),
                            new("Flathead screwdriver", 3, "Tools"),
                            new("Adjustable wrench", 2, "Tools"),
                            new("Pliers", 2, "Tools"),
                            new("Drill bit set", 1, "Tools"),
                            new("Work gloves", 2, "Tools"),
                            new("Extension cord", 1, "Tools")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Paint & Wall Repair",
                        LocationPath: "Garage/Workbench Cabinet",
                        Description: "Painter's tape, brushes, rollers, spackle, and wall anchors.",
                        Items: new List<SeedItemDef>
                        {
                            new("Painter's tape", 4, "Tools"),
                            new("Paint brushes", 6, "Tools"),
                            new("Small paint rollers", 4, "Tools"),
                            new("Spackle", 2, "Tools"),
                            new("Putty knife", 2, "Tools"),
                            new("Sandpaper pack", 1, "Tools"),
                            new("Wall anchors", 30, "Tools"),
                            new("Touch-up paint containers", 3, "Tools")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Holiday Outdoor Lights",
                        LocationPath: "Garage/Overhead Shelf",
                        Description: "Warm white outdoor string lights, timers, and mounting clips.",
                        Items: new List<SeedItemDef>
                        {
                            new("Warm white string lights", 6, "Holiday"),
                            new("Outdoor extension cord", 3, "Holiday"),
                            new("Light timer", 2, "Holiday"),
                            new("Outdoor wreath hanger", 2, "Holiday"),
                            new("Light clips", 80, "Holiday")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Sports Equipment",
                        LocationPath: "Garage/Sports Corner",
                        Description: "Balls, rackets, yoga mats, and exercise equipment.",
                        Items: new List<SeedItemDef>
                        {
                            new("Basketball", 2, "Games"),
                            new("Soccer ball", 2, "Games"),
                            new("Badminton rackets", 4, "Games"),
                            new("Shuttlecocks", 12, "Games"),
                            new("Yoga mat", 2, "Outdoor"),
                            new("Resistance bands", 4, "Outdoor"),
                            new("Bicycle pump", 1, "Tools")
                        }
                    ),

                    new SeedBoxDef(
                        Name: "Baking & Breakfast",
                        LocationPath: "Kitchen Pantry/Baking Shelf",
                        Description: "Baking ingredients, flour, sugars, and breakfast mixes.",
                        Items: new List<SeedItemDef>
                        {
                            new("All-purpose flour", 2, "Pantry"),
                            new("Granulated sugar", 2, "Pantry"),
                            new("Brown sugar", 1, "Pantry"),
                            new("Baking cocoa", 1, "Pantry"),
                            new("Chocolate chips", 3, "Pantry"),
                            new("Pancake mix", 2, "Pantry"),
                            new("Old fashioned oats", 2, "Pantry"),
                            new("Baking powder", 1, "Pantry")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Pasta & Grains",
                        LocationPath: "Kitchen Pantry/Bulk Storage",
                        Description: "Bulk pasta, rice, quinoa, and grains.",
                        Items: new List<SeedItemDef>
                        {
                            new("Penne pasta", 4, "Pantry"),
                            new("Fusilli pasta", 3, "Pantry"),
                            new("Spaghetti", 3, "Pantry"),
                            new("Basmati rice", 2, "Pantry"),
                            new("Quinoa", 2, "Pantry"),
                            new("Couscous", 1, "Pantry")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Snacks & Lunchbox",
                        LocationPath: "Kitchen Pantry/Snacks Shelf",
                        Description: "Granola bars, trail mix, fruit snacks, and lunchbox snacks.",
                        Items: new List<SeedItemDef>
                        {
                            new("Granola bars", 16, "Pantry"),
                            new("Trail mix packs", 10, "Pantry"),
                            new("Crackers", 4, "Pantry"),
                            new("Fruit snack packs", 12, "Pantry"),
                            new("Popcorn bags", 8, "Pantry"),
                            new("Mixed nuts", 3, "Pantry")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Coffee & Tea Reserve",
                        LocationPath: "Kitchen Pantry/Breakfast Shelf",
                        Description: "Whole coffee beans, instant coffee, tea bags, and filters.",
                        Items: new List<SeedItemDef>
                        {
                            new("Coffee beans", 3, "Pantry"),
                            new("Instant coffee", 2, "Pantry"),
                            new("Green tea", 2, "Pantry"),
                            new("Chamomile tea", 1, "Pantry"),
                            new("Masala chai tea bags", 2, "Pantry"),
                            new("Coffee filters", 2, "Pantry")
                        }
                    ),

                    new SeedBoxDef(
                        Name: "Guest Linens",
                        LocationPath: "Hall Closet/Linen Shelf",
                        Description: "Spare bedding and towels for overnight guests.",
                        Items: new List<SeedItemDef>
                        {
                            new("Queen bedsheet set", 2, "Linens"),
                            new("Pillowcase set", 4, "Linens"),
                            new("Bath towel", 4, "Linens"),
                            new("Hand towel", 4, "Linens"),
                            new("Guest blanket", 2, "Linens")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Travel Essentials",
                        LocationPath: "Hall Closet/Upper Shelf",
                        Description: "Luggage tags, packing cubes, travel adapters, and toiletries.",
                        Items: new List<SeedItemDef>
                        {
                            new("Travel toiletry bag", 2, "Travel"),
                            new("Luggage scale", 1, "Travel"),
                            new("Travel adapter", 2, "Travel"),
                            new("Neck pillow", 2, "Travel"),
                            new("Packing cubes", 6, "Travel"),
                            new("TSA bottle set", 2, "Travel"),
                            new("Luggage tags", 4, "Travel")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Emergency Supplies",
                        LocationPath: "Hall Closet/Floor Storage",
                        Description: "Emergency flashlights, batteries, blankets, and power banks.",
                        Items: new List<SeedItemDef>
                        {
                            new("Emergency flashlight", 2, "Emergency"),
                            new("AA batteries", 24, "Emergency"),
                            new("AAA batteries", 20, "Emergency"),
                            new("First aid kit", 1, "Emergency"),
                            new("Emergency blankets", 4, "Emergency"),
                            new("Power bank", 2, "Emergency"),
                            new("Bottled water pack", 1, "Emergency")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Electronics & Cables",
                        LocationPath: "Hall Closet/Upper Shelf",
                        Description: "Spare HDMI, USB-C, Lightning cables, power adapters, and surge protectors.",
                        Items: new List<SeedItemDef>
                        {
                            new("HDMI cables", 5, "Electronics"),
                            new("USB-C cables", 8, "Electronics"),
                            new("Lightning cables", 4, "Electronics"),
                            new("Power adapters", 5, "Electronics"),
                            new("Ethernet cables", 3, "Electronics"),
                            new("Surge protector", 2, "Electronics")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Household Batteries & Bulbs",
                        LocationPath: "Hall Closet/Floor Storage",
                        Description: "Assorted household batteries, LED light bulbs, and replacement bulbs.",
                        Items: new List<SeedItemDef>
                        {
                            new("AA batteries", 24, "Emergency"),
                            new("AAA batteries", 24, "Emergency"),
                            new("CR2032 batteries", 6, "Emergency"),
                            new("LED light bulbs", 8, "Household"),
                            new("Night light bulbs", 4, "Household")
                        }
                    ),

                    new SeedBoxDef(
                        Name: "Winter Accessories",
                        LocationPath: "Primary Bedroom Closet/Top Shelf",
                        Description: "Scarves, beanies, winter gloves, and thermal socks.",
                        Items: new List<SeedItemDef>
                        {
                            new("Knit scarf", 4, "Clothing"),
                            new("Winter gloves", 4, "Clothing"),
                            new("Beanie", 5, "Clothing"),
                            new("Ear warmers", 2, "Clothing"),
                            new("Wool socks", 8, "Clothing")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Occasion Shoes",
                        LocationPath: "Primary Bedroom Closet/Shoe Rack",
                        Description: "Formal dress shoes, boots, and heels.",
                        Items: new List<SeedItemDef>
                        {
                            new("Black dress shoes", 1, "Clothing"),
                            new("Brown boots", 1, "Clothing"),
                            new("Formal heels", 1, "Clothing"),
                            new("Dress sandals", 1, "Clothing")
                        }
                    )
                }
            ),

            // ==================================================
            // STORAGE SPACE 2: "Seasonal & Overflow Storage" (18 Boxes)
            // ==================================================
            new SeedWorkspaceDef(
                Name: "Seasonal & Overflow Storage " + SEED_MARKER,
                Locations: new List<(string Path, string? ParentPath)>
                {
                    ("Basement Storage", null),
                    ("Basement Storage/Shelf A", "Basement Storage"),
                    ("Basement Storage/Shelf B", "Basement Storage"),
                    ("Basement Storage/Shelf C", "Basement Storage"),
                    ("Basement Storage/Under Stairs", "Basement Storage"),

                    ("Kids Room Storage", null),
                    ("Kids Room Storage/Cubby 1", "Kids Room Storage"),
                    ("Kids Room Storage/Cubby 2", "Kids Room Storage"),
                    ("Kids Room Storage/Cubby 3", "Kids Room Storage"),
                    ("Kids Room Storage/Closet Shelf", "Kids Room Storage")
                },
                Boxes: new List<SeedBoxDef>
                {
                    new SeedBoxDef(
                        Name: "Christmas Tree Decorations",
                        LocationPath: "Basement Storage/Shelf A",
                        Description: "Tree ornaments and decorations used during the winter holidays.",
                        SeedQr: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Christmas ornaments", 28, "Holiday"),
                            new("Tree topper", 1, "Holiday"),
                            new("Tree skirt", 1, "Holiday"),
                            new("Ornament hooks", 50, "Holiday"),
                            new("Decorative ribbon", 5, "Holiday")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Holiday Lights & Garland",
                        LocationPath: "Basement Storage/Shelf A",
                        Description: "Indoor fairy lights, garland, candles, and stocking holders.",
                        Items: new List<SeedItemDef>
                        {
                            new("Indoor string lights", 8, "Holiday"),
                            new("Garland", 4, "Holiday"),
                            new("Battery fairy lights", 5, "Holiday"),
                            new("Decorative candles", 6, "Holiday"),
                            new("Stocking holders", 4, "Holiday")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Gift Wrapping Supplies",
                        LocationPath: "Basement Storage/Shelf B",
                        Description: "Wrapping paper, gift bags, tissue paper, ribbons, and gift tags.",
                        Items: new List<SeedItemDef>
                        {
                            new("Wrapping paper rolls", 8, "Party"),
                            new("Gift bags", 18, "Party"),
                            new("Tissue paper packs", 6, "Party"),
                            new("Ribbon rolls", 10, "Party"),
                            new("Gift tags", 30, "Party"),
                            new("Clear tape", 5, "Party")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Fall Decorations",
                        LocationPath: "Basement Storage/Shelf B",
                        Description: "Autumn wreaths, decorative pumpkins, and table runners.",
                        Items: new List<SeedItemDef>
                        {
                            new("Decorative pumpkins", 8, "Seasonal"),
                            new("Fall wreath", 1, "Seasonal"),
                            new("Autumn table runner", 2, "Seasonal"),
                            new("LED candles", 6, "Seasonal"),
                            new("Leaf garland", 3, "Seasonal")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Halloween Decorations",
                        LocationPath: "Basement Storage/Shelf B",
                        Description: "Outdoor spider webs, pumpkins, wreaths, and Halloween costumes.",
                        Items: new List<SeedItemDef>
                        {
                            new("Halloween string lights", 3, "Holiday"),
                            new("Decorative pumpkins", 6, "Seasonal"),
                            new("Spider web decorations", 4, "Seasonal"),
                            new("Door wreath", 1, "Seasonal"),
                            new("LED candles", 6, "Seasonal"),
                            new("Costume accessories", 8, "Party")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Party Supplies",
                        LocationPath: "Basement Storage/Shelf C",
                        Description: "Serving trays, cake stands, party cups, and banners.",
                        Items: new List<SeedItemDef>
                        {
                            new("Serving trays", 4, "Party"),
                            new("Cake stand", 1, "Party"),
                            new("Tablecloths", 5, "Party"),
                            new("String banners", 4, "Party"),
                            new("Reusable party cups", 20, "Party"),
                            new("Decorative lights", 3, "Party")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Easter Decorations",
                        LocationPath: "Basement Storage/Shelf C",
                        Description: "Spring wreaths, easter eggs, baskets, and table decor.",
                        Items: new List<SeedItemDef>
                        {
                            new("Decorative eggs", 24, "Holiday"),
                            new("Easter baskets", 4, "Holiday"),
                            new("Spring table runner", 2, "Seasonal"),
                            new("Bunny decorations", 5, "Seasonal"),
                            new("Pastel garland", 3, "Seasonal")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Summer Picnic Supplies",
                        LocationPath: "Basement Storage/Shelf C",
                        Description: "Picnic blankets, outdoor tableware, cooler bag, and serving trays.",
                        Items: new List<SeedItemDef>
                        {
                            new("Picnic blanket", 2, "Outdoor"),
                            new("Reusable plates", 8, "Party"),
                            new("Reusable cups", 8, "Party"),
                            new("Plastic serving tray", 2, "Party"),
                            new("Outdoor tablecloth", 3, "Party"),
                            new("Cooler bag", 1, "Outdoor")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Keepsakes & Memories",
                        LocationPath: "Basement Storage/Under Stairs",
                        Description: "Family photo albums, souvenirs, and cherished keepsakes.",
                        Items: new List<SeedItemDef>
                        {
                            new("Family photo albums", 6, "Keepsakes"),
                            new("Greeting card collection", 1, "Keepsakes"),
                            new("School keepsakes", 1, "Keepsakes"),
                            new("Travel souvenirs", 12, "Keepsakes"),
                            new("Framed photographs", 8, "Keepsakes")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Winter Snow Gear",
                        LocationPath: "Basement Storage/Under Stairs",
                        Description: "Snow shovels, ice scrapers, boots, sleds, and hand warmers.",
                        Items: new List<SeedItemDef>
                        {
                            new("Snow shovel", 1, "Seasonal"),
                            new("Ice scraper", 2, "Seasonal"),
                            new("Hand warmers", 12, "Emergency"),
                            new("Snow boots", 2, "Clothing"),
                            new("Sled", 1, "Outdoor"),
                            new("Ice melt scoop", 1, "Seasonal")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Extra Bedding",
                        LocationPath: "Basement Storage/Under Stairs",
                        Description: "Spare comforters, pillows, mattress protectors, and throw blankets.",
                        Items: new List<SeedItemDef>
                        {
                            new("Queen comforter", 1, "Linens"),
                            new("Twin comforter", 2, "Linens"),
                            new("Spare pillows", 4, "Linens"),
                            new("Mattress protector", 2, "Linens"),
                            new("Throw blanket", 3, "Linens")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Childhood Keepsakes",
                        LocationPath: "Basement Storage/Under Stairs",
                        Description: "Baby memory books, school artwork, trophies, and childhood photo albums.",
                        Items: new List<SeedItemDef>
                        {
                            new("Baby photo album", 2, "Keepsakes"),
                            new("First-year memory book", 1, "Keepsakes"),
                            new("School artwork folder", 3, "Keepsakes"),
                            new("Childhood trophies", 4, "Keepsakes"),
                            new("Favorite childhood books", 12, "Keepsakes")
                        }
                    ),

                    new SeedBoxDef(
                        Name: "Puzzle Collection",
                        LocationPath: "Kids Room Storage/Cubby 1",
                        Description: "Family jigsaw puzzles and wooden kids puzzles.",
                        Items: new List<SeedItemDef>
                        {
                            new("100-piece puzzle", 3, "Games"),
                            new("300-piece puzzle", 2, "Games"),
                            new("500-piece puzzle", 2, "Games"),
                            new("Wooden puzzle", 4, "Games")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Building Blocks & STEM",
                        LocationPath: "Kids Room Storage/Cubby 2",
                        Description: "Building blocks, magnetic tiles, and educational STEM kits.",
                        Items: new List<SeedItemDef>
                        {
                            new("Building blocks set", 1, "Kids & Crafts"),
                            new("Magnetic tiles", 1, "Kids & Crafts"),
                            new("STEM experiment kit", 2, "Kids & Crafts"),
                            new("Marble run pieces", 1, "Kids & Crafts"),
                            new("Gear building set", 1, "Kids & Crafts")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Craft Supplies",
                        LocationPath: "Kids Room Storage/Cubby 3",
                        Description: "Kids art supplies, paper, paints, stickers, and drawing materials.",
                        SeedBarcode: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Crayon box", 3, "Kids & Crafts"),
                            new("Colored markers", 24, "Kids & Crafts"),
                            new("Glue sticks", 10, "Kids & Crafts"),
                            new("Construction paper pack", 3, "Kids & Crafts"),
                            new("Safety scissors", 3, "Kids & Crafts"),
                            new("Sticker sheets", 20, "Kids & Crafts"),
                            new("Paint brushes", 8, "Kids & Crafts"),
                            new("Sketch pads", 4, "Kids & Crafts")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Board Games",
                        LocationPath: "Kids Room Storage/Closet Shelf",
                        Description: "Family board games, playing cards, and puzzles.",
                        Items: new List<SeedItemDef>
                        {
                            new("Monopoly", 1, "Games"),
                            new("Scrabble", 1, "Games"),
                            new("Uno cards", 2, "Games"),
                            new("Jenga", 1, "Games"),
                            new("Checkers", 1, "Games"),
                            new("Playing cards", 3, "Games")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "School Supplies Reserve",
                        LocationPath: "Kids Room Storage/Closet Shelf",
                        Description: "Reserve notebooks, pencils, erasers, glue sticks, and folders.",
                        Items: new List<SeedItemDef>
                        {
                            new("Spiral notebooks", 12, "Office"),
                            new("Pencils", 48, "Office"),
                            new("Erasers", 20, "Office"),
                            new("Glue sticks", 15, "Kids & Crafts"),
                            new("Colored pencils", 3, "Kids & Crafts"),
                            new("Folders", 10, "Office"),
                            new("Index cards", 5, "Office")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Kids Party Supplies",
                        LocationPath: "Kids Room Storage/Closet Shelf",
                        Description: "Birthday party banners, party hats, paper plates, and favor bags.",
                        Items: new List<SeedItemDef>
                        {
                            new("Birthday banners", 4, "Party"),
                            new("Party hats", 20, "Party"),
                            new("Paper plates", 30, "Party"),
                            new("Napkins", 30, "Party"),
                            new("Favor bags", 20, "Party"),
                            new("Birthday candles", 12, "Party")
                        }
                    )
                }
            ),

            // ==================================================
            // STORAGE SPACE 3: "Cedar Ridge Move" (18 Boxes)
            // ==================================================
            new SeedWorkspaceDef(
                Name: "Cedar Ridge Move " + SEED_MARKER,
                Locations: new List<(string Path, string? ParentPath)>
                {
                    ("Current Home", null),
                    ("Current Home/Garage Staging", "Current Home"),
                    ("Current Home/Kitchen Staging", "Current Home"),
                    ("Current Home/Bedroom Staging", "Current Home"),

                    ("New Home", null),
                    ("New Home/Garage", "New Home"),
                    ("New Home/Pantry", "New Home"),
                    ("New Home/Primary Bedroom", "New Home"),
                    ("New Home/Home Office", "New Home")
                },
                Boxes: new List<SeedBoxDef>
                {
                    new SeedBoxDef(
                        Name: "Kitchen Small Appliances",
                        LocationPath: "Current Home/Kitchen Staging",
                        DestinationLocationPath: "New Home/Pantry",
                        Description: "Frequently used countertop appliances. Unpack early after move.",
                        MovingPriority: "HIGH",
                        IsPacked: true,
                        SeedQr: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Blender", 1, "Kitchen"),
                            new("Toaster", 1, "Kitchen"),
                            new("Hand mixer", 1, "Kitchen"),
                            new("Rice cooker", 1, "Kitchen"),
                            new("Electric kettle", 1, "Kitchen")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Everyday Kitchen",
                        LocationPath: "Current Home/Kitchen Staging",
                        DestinationLocationPath: "New Home/Pantry",
                        Description: "Plates, bowls, glasses, mugs, cutlery, and pans.",
                        MovingPriority: "HIGH",
                        IsPacked: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Dinner plates", 8, "Kitchen"),
                            new("Bowls", 8, "Kitchen"),
                            new("Drinking glasses", 8, "Kitchen"),
                            new("Coffee mugs", 6, "Kitchen"),
                            new("Cutlery set", 1, "Kitchen"),
                            new("Frying pan", 2, "Kitchen")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Pantry Essentials",
                        LocationPath: "Current Home/Kitchen Staging",
                        DestinationLocationPath: "New Home/Pantry",
                        Description: "Dry pantry items, canned goods, cooking oils, and spices.",
                        MovingPriority: "HIGH",
                        IsPacked: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Rice", 2, "Pantry"),
                            new("Pasta", 5, "Pantry"),
                            new("Canned tomatoes", 6, "Pantry"),
                            new("Cooking oil", 2, "Pantry"),
                            new("Spices", 12, "Pantry"),
                            new("Flour", 2, "Pantry"),
                            new("Sugar", 2, "Pantry")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Baking Supplies",
                        LocationPath: "Current Home/Kitchen Staging",
                        DestinationLocationPath: "New Home/Pantry",
                        Description: "Mixing bowls, measuring cups, baking sheets, and cake pans.",
                        MovingPriority: "MEDIUM",
                        IsPacked: false,
                        Items: new List<SeedItemDef>
                        {
                            new("Mixing bowls", 3, "Kitchen"),
                            new("Measuring cups", 1, "Kitchen"),
                            new("Measuring spoons", 1, "Kitchen"),
                            new("Baking sheets", 3, "Kitchen"),
                            new("Cake pan", 2, "Kitchen"),
                            new("Muffin tin", 1, "Kitchen"),
                            new("Rolling pin", 1, "Kitchen")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Coffee Station",
                        LocationPath: "Current Home/Kitchen Staging",
                        DestinationLocationPath: "New Home/Pantry",
                        Description: "Coffee maker, mugs, beans, filters, and travel tumblers.",
                        MovingPriority: "HIGH",
                        IsPacked: true,
                        SeedQr: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Coffee maker", 1, "Kitchen"),
                            new("Coffee mugs", 6, "Kitchen"),
                            new("Coffee beans", 2, "Pantry"),
                            new("Coffee filters", 1, "Pantry"),
                            new("Milk frother", 1, "Kitchen"),
                            new("Travel mugs", 2, "Kitchen")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Pots & Pans",
                        LocationPath: "Current Home/Kitchen Staging",
                        DestinationLocationPath: "New Home/Pantry",
                        Description: "Stock pots, saucepans, frying pans, and colander.",
                        MovingPriority: "MEDIUM",
                        IsPacked: false,
                        Items: new List<SeedItemDef>
                        {
                            new("Stock pot", 1, "Kitchen"),
                            new("Saucepan", 3, "Kitchen"),
                            new("Frying pan", 2, "Kitchen"),
                            new("Pot lids", 5, "Kitchen"),
                            new("Colander", 1, "Kitchen")
                        }
                    ),

                    new SeedBoxDef(
                        Name: "Bedroom Essentials",
                        LocationPath: "Current Home/Bedroom Staging",
                        DestinationLocationPath: "New Home/Primary Bedroom",
                        Description: "Bedsheets, pillows, comforter, chargers, and lamps.",
                        MovingPriority: "HIGH",
                        IsPacked: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Bedsheets", 2, "Linens"),
                            new("Pillows", 4, "Linens"),
                            new("Comforter", 1, "Linens"),
                            new("Phone chargers", 3, "Office"),
                            new("Bedside lamp", 2, "Household")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Bathroom Essentials",
                        LocationPath: "Current Home/Bedroom Staging",
                        DestinationLocationPath: "New Home/Primary Bedroom",
                        Description: "Bath towels, shower curtain, toiletries, and hair dryer.",
                        MovingPriority: "HIGH",
                        IsPacked: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Bath towels", 4, "Linens"),
                            new("Hand towels", 4, "Linens"),
                            new("Shower curtain", 1, "Household"),
                            new("Toiletry organizer", 1, "Travel"),
                            new("Hair dryer", 1, "Household"),
                            new("First aid kit", 1, "Emergency")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Closet Accessories",
                        LocationPath: "Current Home/Bedroom Staging",
                        DestinationLocationPath: "New Home/Primary Bedroom",
                        Description: "Hangers, shoe organizers, garment bags, and storage baskets.",
                        MovingPriority: "MEDIUM",
                        IsPacked: false,
                        Items: new List<SeedItemDef>
                        {
                            new("Clothes hangers", 30, "Clothing"),
                            new("Shoe organizer", 1, "Clothing"),
                            new("Garment bags", 3, "Clothing"),
                            new("Belt organizer", 1, "Clothing"),
                            new("Storage baskets", 4, "Household")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Winter Clothes",
                        LocationPath: "Current Home/Bedroom Staging",
                        DestinationLocationPath: "New Home/Primary Bedroom",
                        Description: "Heavy winter coats, knit sweaters, scarves, and gloves.",
                        MovingPriority: "LOW",
                        IsPacked: false,
                        Items: new List<SeedItemDef>
                        {
                            new("Winter jackets", 4, "Clothing"),
                            new("Sweaters", 8, "Clothing"),
                            new("Scarves", 5, "Clothing"),
                            new("Gloves", 4, "Clothing"),
                            new("Winter hats", 4, "Clothing")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Books & Office",
                        LocationPath: "Current Home/Bedroom Staging",
                        DestinationLocationPath: "New Home/Home Office",
                        Description: "Hardcover books, notebooks, paper, desk accessories.",
                        MovingPriority: "LOW",
                        IsPacked: false,
                        Items: new List<SeedItemDef>
                        {
                            new("Hardcover books", 18, "Office"),
                            new("Notebooks", 6, "Office"),
                            new("Printer paper", 2, "Office"),
                            new("Desk organizer", 1, "Office"),
                            new("USB cables", 5, "Office")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Home Office Electronics",
                        LocationPath: "Current Home/Bedroom Staging",
                        DestinationLocationPath: "New Home/Home Office",
                        Description: "Monitors, keyboards, mice, docks, and HDMI/USB-C cables.",
                        MovingPriority: "HIGH",
                        IsPacked: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Computer monitor", 2, "Office"),
                            new("Keyboard", 2, "Office"),
                            new("Mouse", 2, "Office"),
                            new("Laptop dock", 1, "Office"),
                            new("HDMI cables", 4, "Office"),
                            new("USB-C cables", 5, "Office")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Important Office Supplies",
                        LocationPath: "Current Home/Bedroom Staging",
                        DestinationLocationPath: "New Home/Home Office",
                        Description: "Printer paper, file folders, stapler, pens, and label maker.",
                        MovingPriority: "MEDIUM",
                        IsPacked: false,
                        Items: new List<SeedItemDef>
                        {
                            new("Printer paper", 3, "Office"),
                            new("File folders", 20, "Office"),
                            new("Stapler", 1, "Office"),
                            new("Pens", 15, "Office"),
                            new("Sticky notes", 8, "Office"),
                            new("Label maker", 1, "Office")
                        }
                    ),

                    new SeedBoxDef(
                        Name: "Cleaning Supplies",
                        LocationPath: "Current Home/Garage Staging",
                        DestinationLocationPath: "New Home/Garage",
                        Description: "All-purpose cleaners, microfiber cloths, gloves, and trash bags.",
                        MovingPriority: "HIGH",
                        IsPacked: true,
                        Items: new List<SeedItemDef>
                        {
                            new("All-purpose cleaner", 3, "Household"),
                            new("Glass cleaner", 2, "Household"),
                            new("Microfiber cloths", 12, "Household"),
                            new("Scrub brushes", 4, "Household"),
                            new("Rubber gloves", 4, "Household"),
                            new("Trash bags", 2, "Household")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Garage Miscellaneous",
                        LocationPath: "Current Home/Garage Staging",
                        DestinationLocationPath: "New Home/Garage",
                        Description: "Extension cords, bungee cords, work gloves, and flashlights.",
                        MovingPriority: "MEDIUM",
                        IsPacked: false,
                        Items: new List<SeedItemDef>
                        {
                            new("Extension cords", 3, "Tools"),
                            new("Bungee cords", 8, "Tools"),
                            new("Work gloves", 3, "Tools"),
                            new("Utility knife", 2, "Tools"),
                            new("Flashlights", 3, "Emergency")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Garage Hand Tools",
                        LocationPath: "Current Home/Garage Staging",
                        DestinationLocationPath: "New Home/Garage",
                        Description: "Hammers, screwdrivers, wrenches, pliers, and tape measures.",
                        MovingPriority: "MEDIUM",
                        IsPacked: false,
                        SeedBarcode: true,
                        Items: new List<SeedItemDef>
                        {
                            new("Hammer", 2, "Tools"),
                            new("Screwdriver set", 1, "Tools"),
                            new("Pliers", 2, "Tools"),
                            new("Adjustable wrench", 2, "Tools"),
                            new("Tape measure", 2, "Tools"),
                            new("Utility knife", 2, "Tools")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Garage Storage Hardware",
                        LocationPath: "Current Home/Garage Staging",
                        DestinationLocationPath: "New Home/Garage",
                        Description: "Wall hooks, shelf brackets, storage labels, bungee cords, and zip ties.",
                        MovingPriority: "LOW",
                        IsPacked: false,
                        Items: new List<SeedItemDef>
                        {
                            new("Wall hooks", 12, "Tools"),
                            new("Shelf brackets", 8, "Tools"),
                            new("Storage bin labels", 20, "Tools"),
                            new("Bungee cords", 10, "Tools"),
                            new("Zip ties", 50, "Tools")
                        }
                    ),
                    new SeedBoxDef(
                        Name: "Outdoor Moving Supplies",
                        LocationPath: "Current Home/Garage Staging",
                        DestinationLocationPath: "New Home/Garage",
                        Description: "Moving blankets, ratchet straps, furniture sliders, and work gloves.",
                        MovingPriority: "MEDIUM",
                        IsPacked: false,
                        Items: new List<SeedItemDef>
                        {
                            new("Moving blankets", 6, "Tools"),
                            new("Ratchet straps", 4, "Tools"),
                            new("Hand truck straps", 2, "Tools"),
                            new("Furniture sliders", 8, "Tools"),
                            new("Work gloves", 4, "Tools")
                        }
                    )
                }
            )
        };
    }

}

internal record SeedItemDef(string Name, int Quantity, string Category);

internal record SeedBoxDef(
    string Name,
    string LocationPath,
    string Description,
    List<SeedItemDef> Items,
    bool SeedQr = false,
    bool SeedBarcode = false,
    string? DestinationLocationPath = null,
    bool IsPacked = false,
    string? MovingPriority = null
);

internal record SeedWorkspaceDef(
    string Name,
    List<(string Path, string? ParentPath)> Locations,
    List<SeedBoxDef> Boxes
);

