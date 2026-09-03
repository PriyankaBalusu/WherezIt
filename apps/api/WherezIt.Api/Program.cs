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
builder.Services.AddInfrastructure(builder.Configuration, builder.Environment);

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
var defaultAllowedOrigins = builder.Environment.IsDevelopment()
    ? new[] { "http://localhost:5173", "http://127.0.0.1:5173" }
    : new[] { "https://wherezit-505615.web.app", "https://wherezit-505615.firebaseapp.com" };

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? defaultAllowedOrigins;

builder.Services.AddCors(options =>
{
    options.AddPolicy("WherezItCorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Automatically apply EF Core migrations and update check constraints on startup
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<WherezIt.Infrastructure.Persistence.WherezItDbContext>();
    await dbContext.Database.MigrateAsync();
}

var useMockVision = builder.Configuration.GetValue<bool>("Gemini:UseMockVision", false) || builder.Configuration.GetValue<bool>("AI:UseMockVision", false);
app.Logger.LogInformation("IInventoryVisionProvider registered as: {Provider}", useMockVision ? "MockInventoryVisionProvider" : "VertexAiGeminiVisionProvider");

app.UseCors("WherezItCorsPolicy");

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

// Development-only Bug 4 preview seed CLI
if (app.Environment.IsDevelopment() && args.Contains("--seed-bug4"))
{
    var index = Array.IndexOf(args, "--seed-bug4");

    if (index + 2 >= args.Length)
    {
        Console.Error.WriteLine(
            "Usage: dotnet run -- --seed-bug4 <firebaseUid> <email>");
        return;
    }

    var firebaseUid = args[index + 1];
    var email = args[index + 2];

    using var scope = app.Services.CreateScope();
    var seedService = scope.ServiceProvider.GetRequiredService<IBug4SeedService>();
    var result = await seedService.SeedBug4DataAsync(firebaseUid, email);

    Console.WriteLine($"Bug 4 seed completed: Created {result.ContainersCreated}, Skipped {result.ContainersSkipped}. Workspace '{result.WorkspaceName}' ({result.WorkspaceId}). {result.Message}");
    return;
}

// Development-only Bug 4 seed cleanup CLI
if (app.Environment.IsDevelopment() && args.Contains("--cleanup-bug4"))
{
    var index = Array.IndexOf(args, "--cleanup-bug4");

    if (index + 2 >= args.Length)
    {
        Console.Error.WriteLine(
            "Usage: dotnet run -- --cleanup-bug4 <firebaseUid> <email>");
        return;
    }

    var firebaseUid = args[index + 1];
    var email = args[index + 2];

    using var scope = app.Services.CreateScope();
    var seedService = scope.ServiceProvider.GetRequiredService<IBug4SeedService>();
    var result = await seedService.CleanupBug4DataAsync(firebaseUid, email);

    Console.WriteLine($"Bug 4 cleanup completed: Removed {result.ContainersRemoved} seed containers from Workspace ({result.WorkspaceId}). {result.Message}");
    return;
}

// Large Demo Data Seeder CLI
var allowDemoSeed = string.Equals(Environment.GetEnvironmentVariable("WHEREZIT_ALLOW_DEMO_SEED"), "true", StringComparison.OrdinalIgnoreCase);

if (args.Contains("--seed-demo-data"))
{
    if (!app.Environment.IsDevelopment() && !allowDemoSeed)
    {
        Console.Error.WriteLine("Demo data seeding is restricted to Development environment or requires WHEREZIT_ALLOW_DEMO_SEED=true.");
        return;
    }

    var index = Array.IndexOf(args, "--seed-demo-data");
    if (index + 2 >= args.Length)
    {
        Console.Error.WriteLine("Usage: dotnet run -- --seed-demo-data <firebaseUid> <email>");
        return;
    }

    var firebaseUid = args[index + 1];
    var email = args[index + 2];

    using var scope = app.Services.CreateScope();
    var demoSeedService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.Seed.Services.IDemoDataSeedService>();
    var result = await demoSeedService.SeedDemoDataAsync(firebaseUid, email);

    Console.WriteLine("Demo Seed Complete");
    Console.WriteLine($"User: {firebaseUid} ({email})");
    Console.WriteLine($"Demo image directory: {result.ResolvedImageDirectory}");
    Console.WriteLine($"Storage Spaces: Created {result.WorkspacesCreated}, Skipped {result.WorkspacesSkipped}");
    Console.WriteLine($"Locations: Created {result.LocationsCreated}");
    Console.WriteLine($"Boxes: Created {result.BoxesCreated}");
    Console.WriteLine($"Items: Created {result.ItemsCreated}");
    Console.WriteLine($"Reference Photos: Created {result.ReferencePhotosCreated}");
    Console.WriteLine($"Item Photos: Created {result.ItemPhotosCreated}");
    Console.WriteLine($"Moving-state boxes: Packed {result.PackedBoxes}, Open-first {result.OpenFirstBoxes}, Temporary-location {result.TemporaryLocationBoxes}");
    Console.WriteLine($"Errors: {result.Errors}");
    Console.WriteLine(result.Message);
    return;
}

if (args.Contains("--cleanup-demo-data"))
{
    if (!app.Environment.IsDevelopment() && !allowDemoSeed)
    {
        Console.Error.WriteLine("Demo data cleanup is restricted to Development environment or requires WHEREZIT_ALLOW_DEMO_SEED=true.");
        return;
    }

    var index = Array.IndexOf(args, "--cleanup-demo-data");
    if (index + 1 >= args.Length)
    {
        Console.Error.WriteLine("Usage: dotnet run -- --cleanup-demo-data <firebaseUid>");
        return;
    }

    var firebaseUid = args[index + 1];

    using var scope = app.Services.CreateScope();
    var demoSeedService = scope.ServiceProvider.GetRequiredService<WherezIt.Application.Seed.Services.IDemoDataSeedService>();
    var result = await demoSeedService.CleanupDemoDataAsync(firebaseUid);

    Console.WriteLine("Demo Cleanup Complete");
    Console.WriteLine($"User: {firebaseUid}");
    Console.WriteLine($"Storage Spaces Removed: {result.WorkspacesRemoved}");
    Console.WriteLine($"Locations Removed: {result.LocationsRemoved}");
    Console.WriteLine($"Boxes Removed: {result.BoxesRemoved}");
    Console.WriteLine($"Items Removed: {result.ItemsRemoved}");
    Console.WriteLine($"Image Assets Removed: {result.ImageAssetsRemoved}");
    Console.WriteLine(result.Message);
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
