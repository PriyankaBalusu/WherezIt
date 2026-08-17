namespace WherezIt.Application.Containers.Services;

public interface IBoxNumberAllocator
{
    Task<int> AllocateNextAsync(Guid workspaceId, CancellationToken cancellationToken = default);
}
