using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;

namespace WherezIt.Application.StorageLocations.Services;

public interface IBreadcrumbService
{
    Task<BreadcrumbResponseDto> GetBreadcrumbAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        CancellationToken cancellationToken = default);
}
