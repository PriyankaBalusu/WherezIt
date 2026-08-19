using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;
using WherezIt.Application.Seed.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Users.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;

namespace WherezIt.Infrastructure.Seed;

public class DemoSeedService : IDemoSeedService
{
    private readonly IHostEnvironment _environment;
    private readonly IUserService _userService;
    private readonly IWorkspaceService _workspaceService;
    private readonly IStorageLocationService _locationService;
    private readonly IContainerService _containerService;
    private readonly IItemService _itemService;
    private readonly ILogger<DemoSeedService> _logger;

    public DemoSeedService(
        IHostEnvironment environment,
        IUserService userService,
        IWorkspaceService workspaceService,
        IStorageLocationService locationService,
        IContainerService containerService,
        IItemService itemService,
        ILogger<DemoSeedService> logger)
    {
        _environment = environment;
        _userService = userService;
        _workspaceService = workspaceService;
        _locationService = locationService;
        _containerService = containerService;
        _itemService = itemService;
        _logger = logger;
    }

    public async Task<DemoSeedResult> SeedDemoDataAsync(string firebaseUid, string userEmail, CancellationToken cancellationToken = default)
    {
        if (_environment.IsProduction())
        {
            throw new InvalidOperationException("Demo seeding is strictly forbidden in Production environment.");
        }

        if (string.IsNullOrWhiteSpace(firebaseUid))
        {
            throw new ArgumentException("Firebase UID is required for seeding demo data.", nameof(firebaseUid));
        }

        var identity = new AuthenticatedIdentity(firebaseUid, userEmail ?? $"{firebaseUid}@demo.wherezit", true);
        await _userService.SyncCurrentUserAsync(identity, cancellationToken);

        // Idempotency check: look for existing "Demo Home Workspace"
        var userWorkspaces = await _workspaceService.GetUserWorkspacesAsync(identity, cancellationToken);
        var existingDemoWs = userWorkspaces.FirstOrDefault(w => string.Equals(w.Name, "Demo Home Workspace", StringComparison.OrdinalIgnoreCase));

        if (existingDemoWs != null)
        {
            _logger.LogInformation("Demo workspace already exists for user {Uid}. Skipping creation.", firebaseUid);
            return new DemoSeedResult(true, existingDemoWs.Id.ToString(), existingDemoWs.Name, 0, 0, 0, "Demo workspace already exists. No duplicates created.");
        }

        // 1. Create Workspace
        var ws = await _workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Demo Home Workspace"), cancellationToken);

        // 2. Create Storage Locations
        var garage = await _locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Garage", null), cancellationToken);
        var rackA = await _locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Rack A", garage.Id), cancellationToken);
        var shelf1 = await _locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Shelf 1", rackA.Id), cancellationToken);
        var shelf2 = await _locationService.CreateLocationAsync(identity, ws.Id, new CreateStorageLocationRequestDto("Shelf 2", rackA.Id), cancellationToken);

        // 3. Create Containers with MOV-001 metadata
        var box1 = await _containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(
            shelf1.Id,
            "Holiday Decorations",
            "Boxes containing tree lights, ornaments, and seasonal decor",
            shelf1.Id,
            true,
            "HIGH"
        ), cancellationToken);

        var box2 = await _containerService.CreateContainerAsync(identity, ws.Id, new CreateContainerRequestDto(
            shelf2.Id,
            "Camping Gear",
            "Gear for weekend hiking and outdoor camping",
            shelf2.Id,
            false,
            "MEDIUM"
        ), cancellationToken);

        // 4. Create trusted Items
        await _itemService.CreateItemAsync(identity, ws.Id, box1.Id, new CreateItemRequestDto("Christmas Lights", 2, "Holiday Decor"), cancellationToken);
        await _itemService.CreateItemAsync(identity, ws.Id, box1.Id, new CreateItemRequestDto("Tree Ornaments", 24, "Holiday Decor"), cancellationToken);
        await _itemService.CreateItemAsync(identity, ws.Id, box1.Id, new CreateItemRequestDto("Extension Cords", 3, "Tools"), cancellationToken);

        await _itemService.CreateItemAsync(identity, ws.Id, box2.Id, new CreateItemRequestDto("Tent Stakes", 8, "Camping"), cancellationToken);
        await _itemService.CreateItemAsync(identity, ws.Id, box2.Id, new CreateItemRequestDto("Lantern", 2, "Camping"), cancellationToken);

        _logger.LogInformation("Demo seed complete for workspace {WorkspaceId}.", ws.Id);
        return new DemoSeedResult(true, ws.Id.ToString(), ws.Name, 4, 2, 5, "Demo seed completed successfully.");
    }
}
