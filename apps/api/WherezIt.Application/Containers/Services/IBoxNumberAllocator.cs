namespace WherezIt.Application.Containers.Services;

public interface IBoxNumberAllocator
{
    Task<int> AllocateNextAsync(Guid inventoryNamespaceId, CancellationToken cancellationToken = default);
}
