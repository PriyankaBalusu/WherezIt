using System;
using System.Threading;
using System.Threading.Tasks;

namespace WherezIt.Application.Seed.Services;

public record Bug4SeedResult(
    bool Success,
    string WorkspaceId,
    string WorkspaceName,
    int ContainersCreated,
    int ContainersSkipped,
    string Message
);

public record Bug4CleanupResult(
    bool Success,
    string WorkspaceId,
    int ContainersRemoved,
    string Message
);

public interface IBug4SeedService
{
    Task<Bug4SeedResult> SeedBug4DataAsync(string firebaseUid, string userEmail, CancellationToken cancellationToken = default);
    Task<Bug4CleanupResult> CleanupBug4DataAsync(string firebaseUid, string userEmail, CancellationToken cancellationToken = default);
}
