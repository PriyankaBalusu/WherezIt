using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using WherezIt.Application.AI.Services;

namespace WherezIt.Infrastructure.Services;

public class LocalDevProcessingQueue : IAIProcessingQueue
{
    private readonly ILogger<LocalDevProcessingQueue> _logger;

    public LocalDevProcessingQueue(ILogger<LocalDevProcessingQueue> logger)
    {
        _logger = logger;
    }

    public Task EnqueueJobAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Enqueued job {JobId} into LocalDevProcessingQueue (payload contains jobId only).", jobId);
        return Task.CompletedTask;
    }
}
