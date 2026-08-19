using System;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WherezIt.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddInfrastructure(builder.Configuration);

// SEC-001 Rate Limiting Policies
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
        {
            context.HttpContext.Response.Headers.RetryAfter = ((int)retryAfter.TotalSeconds).ToString();
        }
        await context.HttpContext.Response.WriteAsJsonAsync(new { error = "Rate limit exceeded. Please try again later." }, cancellationToken: token);
    };

    // 1. General API Policy: 100 req / min
    options.AddPolicy("GeneralApiPolicy", httpContext =>
    {
        var partitionKey = GetPartitionKey(httpContext);
        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 100,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });

    // 2. AI Endpoint Policy: 10 req / min
    options.AddPolicy("AiEndpointPolicy", httpContext =>
    {
        var partitionKey = GetPartitionKey(httpContext);
        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });

    // 3. Identifier Resolve Policy: 30 req / min
    options.AddPolicy("IdentifierResolvePolicy", httpContext =>
    {
        var partitionKey = GetPartitionKey(httpContext);
        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 30,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0
        });
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

// Process liveness endpoint (API alive, no external DB dependency check)
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTimeOffset.UtcNow })).DisableRateLimiting();
app.MapGet("/api/v1/health", () => Results.Ok(new { status = "Healthy", version = "v1", timestamp = DateTimeOffset.UtcNow })).DisableRateLimiting();

// Database readiness endpoint (verifies active PostgreSQL connection)
app.MapHealthChecks("/health/ready").DisableRateLimiting();

app.MapControllers();

app.Run();

static string GetPartitionKey(HttpContext httpContext)
{
    var uid = httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
              ?? httpContext.User.FindFirst("user_id")?.Value
              ?? httpContext.User.FindFirst("uid")?.Value;

    if (!string.IsNullOrEmpty(uid))
    {
        return $"uid:{uid}";
    }

    var remoteIp = httpContext.Connection.RemoteIpAddress?.ToString();
    return string.IsNullOrEmpty(remoteIp) ? "ip:unknown" : $"ip:{remoteIp}";
}

public partial class Program { }
