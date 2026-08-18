using System;
using System.Threading;
using System.Threading.Tasks;

namespace WherezIt.Application.AI.Services;

public interface IAIProcessingQueue
{
    Task EnqueueJobAsync(Guid jobId, CancellationToken cancellationToken = default);
}
