using System.Threading;
using System.Threading.Tasks;
using WherezIt.Application.Workspaces.Dtos;

namespace WherezIt.Application.Seed.Services;

public record LegacyDemoSeedResult(
    bool Success,
    string WorkspaceId,
    string WorkspaceName,
    int LocationsCreated,
    int ContainersCreated,
    int ItemsCreated,
    string Message
);

public interface IDemoSeedService
{
    Task<LegacyDemoSeedResult> SeedDemoDataAsync(string firebaseUid, string userEmail, CancellationToken cancellationToken = default);
}
