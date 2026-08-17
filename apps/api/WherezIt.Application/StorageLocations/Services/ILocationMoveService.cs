using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;

namespace WherezIt.Application.StorageLocations.Services;

public interface ILocationMoveService
{
    Task<StorageLocationResponseDto> MoveLocationAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid locationId,
        MoveStorageLocationRequestDto request,
        CancellationToken cancellationToken = default);
}
