using System;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WherezIt.Infrastructure;
using WherezIt.Application.Seed.Services;

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

// CORS Configuration
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173", "http://127.0.0.1:5173" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("DevelopmentCors", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

var useMockVision = builder.Configuration.GetValue<bool>("Gemini:UseMockVision", false) || builder.Configuration.GetValue<bool>("AI:UseMockVision", false);
app.Logger.LogInformation("IInventoryVisionProvider registered as: {Provider}", useMockVision ? "MockInventoryVisionProvider" : "VertexAiGeminiVisionProvider");

if (app.Environment.IsDevelopment())
{
    app.UseCors("DevelopmentCors");
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

// Development-only demo seed CLI
if (app.Environment.IsDevelopment() && args.Contains("--seed-demo"))
{
    var index = Array.IndexOf(args, "--seed-demo");

    if (index + 2 >= args.Length)
    {
        Console.Error.WriteLine(
            "Usage: dotnet run -- --seed-demo <firebaseUid> <email>");
        return;
    }

    var firebaseUid = args[index + 1];
    var email = args[index + 2];

    using var scope = app.Services.CreateScope();

    var seedService =
        scope.ServiceProvider.GetRequiredService<IDemoSeedService>();

    var result =
        await seedService.SeedDemoDataAsync(firebaseUid, email);

    Console.WriteLine($"Demo seed completed: {result.Message}");
    return;
}

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
