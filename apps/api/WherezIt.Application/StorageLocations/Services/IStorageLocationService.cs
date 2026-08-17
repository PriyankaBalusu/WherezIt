using WherezIt.Application.Authentication;
using WherezIt.Application.StorageLocations.Dtos;

namespace WherezIt.Application.StorageLocations.Services;

public interface IStorageLocationService
{
    Task<List<StorageLocationResponseDto>> GetLocationsAsync(AuthenticatedIdentity identity, Guid workspaceId, CancellationToken cancellationToken = default);
    Task<StorageLocationResponseDto> GetLocationAsync(AuthenticatedIdentity identity, Guid workspaceId, Guid locationId, CancellationToken cancellationToken = default);
    Task<StorageLocationResponseDto> CreateLocationAsync(AuthenticatedIdentity identity, Guid workspaceId, CreateStorageLocationRequestDto request, CancellationToken cancellationToken = default);
    Task<StorageLocationResponseDto> RenameLocationAsync(AuthenticatedIdentity identity, Guid workspaceId, Guid locationId, RenameStorageLocationRequestDto request, CancellationToken cancellationToken = default);
    Task DeleteLocationAsync(AuthenticatedIdentity identity, Guid workspaceId, Guid locationId, CancellationToken cancellationToken = default);
}
