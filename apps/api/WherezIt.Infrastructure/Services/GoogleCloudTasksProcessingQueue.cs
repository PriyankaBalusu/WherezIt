using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using WherezIt.Application.AI.Services;

namespace WherezIt.Infrastructure.Services;

public class CloudTasksOptions
{
    public string ProjectId { get; set; } = "wherezit-505615";
    public string Location { get; set; } = "us-central1";
    public string QueueName { get; set; } = "ai-processing-queue";
    public string ServiceAccountEmail { get; set; } = "wherezit-cloudtasks-sa@wherezit-505615.iam.gserviceaccount.com";
    public string WorkerBaseUrl { get; set; } = "https://wherezit-api-dev-505615.us-central1.run.app";
}

public class GoogleCloudTasksProcessingQueue : IAIProcessingQueue
{
    private readonly CloudTasksOptions _options;
    private readonly ILogger<GoogleCloudTasksProcessingQueue> _logger;

    public GoogleCloudTasksProcessingQueue(CloudTasksOptions options, ILogger<GoogleCloudTasksProcessingQueue> logger)
    {
        _options = options;
        _logger = logger;
    }

    public Task EnqueueJobAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        // Minimal payload contains jobId only per AI-002 contract
        var payload = JsonSerializer.Serialize(new { jobId });
        var taskName = $"projects/{_options.ProjectId}/locations/{_options.Location}/queues/{_options.QueueName}/tasks/ai-job-{jobId:N}";

        _logger.LogInformation("Cloud Tasks queue mock: Task {TaskName} created with payload {Payload}.", taskName, payload);

        return Task.CompletedTask;
    }
}
