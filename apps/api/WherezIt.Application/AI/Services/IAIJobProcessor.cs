using System;
using System.Threading;
using System.Threading.Tasks;

namespace WherezIt.Application.AI.Services;

public interface IAIJobProcessor
{
    Task ProcessJobAsync(Guid jobId, CancellationToken cancellationToken = default);
}
