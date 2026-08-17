using WherezIt.Application.Authentication;
using WherezIt.Application.Items.Dtos;

namespace WherezIt.Application.Items.Services;

public interface IItemService
{
    Task<IReadOnlyList<ItemResponseDto>> GetItemsByContainerAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        bool includeArchived = false,
        CancellationToken cancellationToken = default);

    Task<ItemResponseDto> GetItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default);

    Task<ItemResponseDto> CreateItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid containerId,
        CreateItemRequestDto request,
        CancellationToken cancellationToken = default);

    Task<ItemResponseDto> UpdateItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        UpdateItemRequestDto request,
        CancellationToken cancellationToken = default);

    Task<ItemResponseDto> ArchiveItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default);

    Task<ItemResponseDto> RestoreItemAsync(
        AuthenticatedIdentity identity,
        Guid workspaceId,
        Guid itemId,
        CancellationToken cancellationToken = default);
}
