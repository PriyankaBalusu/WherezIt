using System;
using System.Threading;
using System.Threading.Tasks;

namespace WherezIt.Application.Seed.Services;

public record DemoSeedResult(
    bool Success,
    int WorkspacesCreated,
    int WorkspacesSkipped,
    int LocationsCreated,
    int BoxesCreated,
    int ItemsCreated,
    int ReferencePhotosCreated,
    int ReferencePhotosSkipped,
    int ItemPhotosCreated,
    int ItemPhotosSkipped,
    int RepresentativeActivityEvents,
    int PackedBoxes,
    int OpenFirstBoxes,
    int TemporaryLocationBoxes,
    int Errors,
    string ResolvedImageDirectory,
    string Message
);

public record DemoCleanupResult(
    bool Success,
    int WorkspacesRemoved,
    int LocationsRemoved,
    int BoxesRemoved,
    int ItemsRemoved,
    int ImageAssetsRemoved,
    string Message
);

public interface IDemoDataSeedService
{
    Task<DemoSeedResult> SeedDemoDataAsync(string firebaseUid, string userEmail, CancellationToken cancellationToken = default);
    Task<DemoCleanupResult> CleanupDemoDataAsync(string firebaseUid, CancellationToken cancellationToken = default);
}
