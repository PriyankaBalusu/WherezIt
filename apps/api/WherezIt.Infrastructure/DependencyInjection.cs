using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment? environment = null)
    {
        var connectionString = configuration.GetConnectionString("PostgreSQL");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "PostgreSQL connection string 'ConnectionStrings:PostgreSQL' is not configured.");
        }

        services.AddDbContext<WherezItDbContext>(options =>
        {
            options.UseNpgsql(connectionString);
        });

        services.AddAuthentication("Firebase")
            .AddScheme<Microsoft.AspNetCore.Authentication.AuthenticationSchemeOptions, Authentication.FirebaseAuthenticationHandler>("Firebase", _ => { });

        services.AddSingleton<WherezIt.Application.Authentication.Services.IGoogleOidcTokenValidator, Authentication.GoogleOidcTokenValidator>();

        services.AddScoped<WherezIt.Application.Users.Services.IUserService, Services.UserService>();
        services.AddScoped<WherezIt.Application.Workspaces.Services.IWorkspaceService, Services.WorkspaceService>();
        services.AddScoped<WherezIt.Application.Workspaces.Services.IWorkspaceAuthorizationService, Services.WorkspaceAuthorizationService>();
        services.AddScoped<WherezIt.Application.StorageLocations.Services.IStorageLocationService, Services.StorageLocationService>();
        services.AddScoped<WherezIt.Application.StorageLocations.Services.ILocationMoveService, Services.LocationMoveService>();
        services.AddScoped<WherezIt.Application.StorageLocations.Services.IBreadcrumbService, Services.BreadcrumbService>();
        services.AddScoped<WherezIt.Application.Containers.Services.IBoxNumberAllocator, Services.PostgreSqlBoxNumberAllocator>();
        services.AddScoped<WherezIt.Application.Containers.Services.IContainerService, Services.ContainerService>();
        services.AddScoped<WherezIt.Application.Containers.Services.IContainerMoveService, Services.ContainerMoveService>();
        services.AddScoped<WherezIt.Application.Containers.Services.IContainerTransferService, Services.ContainerTransferService>();
        services.AddScoped<WherezIt.Application.Items.Services.IItemService, Services.ItemService>();
        services.AddScoped<WherezIt.Application.Images.Services.IImageManagementService, Services.ImageManagementService>();

        var isDevelopment = environment?.IsDevelopment()
            ?? string.Equals(configuration["ASPNETCORE_ENVIRONMENT"], "Development", StringComparison.OrdinalIgnoreCase);

        if (isDevelopment)
        {
            services.AddSingleton<WherezIt.Application.Storage.Services.IImageObjectStorage, Services.LocalDevImageObjectStorage>();
        }
        else
        {
            var bucketName = configuration["GoogleCloud:StorageBucket"];
            if (string.IsNullOrWhiteSpace(bucketName))
            {
                throw new InvalidOperationException(
                    "Google Cloud Storage bucket name 'GoogleCloud:StorageBucket' is not configured for non-development environment.");
            }

            services.AddSingleton(_ => Google.Cloud.Storage.V1.StorageClient.Create());
            services.AddSingleton<WherezIt.Application.Storage.Services.IImageObjectStorage>(sp =>
                new Services.GoogleCloudImageObjectStorage(
                    sp.GetRequiredService<Google.Cloud.Storage.V1.StorageClient>(),
                    bucketName));
        }

        services.AddScoped<WherezIt.Application.Search.Services.ISearchService, Services.SearchService>();
        services.AddScoped<WherezIt.Application.Search.Services.IWorkspaceSearchService, Services.WorkspaceSearchService>();
        services.Configure<Services.GeminiOptions>(configuration.GetSection("Gemini"));
        services.AddHttpClient<Services.VertexAiGeminiVisionProvider>();

        var useMockVision = configuration.GetValue<bool>("Gemini:UseMockVision", false) || configuration.GetValue<bool>("AI:UseMockVision", false);
        if (useMockVision)
        {
            services.AddScoped<WherezIt.Application.AI.Services.IInventoryVisionProvider, Services.MockInventoryVisionProvider>();
        }
        else
        {
            services.AddScoped<WherezIt.Application.AI.Services.IInventoryVisionProvider, Services.VertexAiGeminiVisionProvider>();
        }

        services.AddScoped<WherezIt.Application.AI.Services.IAIJobProcessor, Services.AIJobProcessor>();
        services.AddScoped<WherezIt.Application.AI.Services.IAICaptureReviewService, Services.AICaptureReviewService>();
        services.AddScoped<WherezIt.Application.AI.Services.IAICaptureConfirmationService, Services.AICaptureConfirmationService>();
        services.AddScoped<WherezIt.Application.Identifiers.Services.IIdentifierService, Services.IdentifierService>();
        services.AddScoped<WherezIt.Application.ActivityHistory.Services.IActivityHistoryService, Services.ActivityHistoryService>();
        services.AddScoped<WherezIt.Application.Seed.Services.IDemoSeedService, Seed.DemoSeedService>();
        services.AddScoped<WherezIt.Application.Seed.Services.IBug4SeedService, Seed.Bug4SeedService>();
        services.AddScoped<WherezIt.Application.Seed.Services.IDemoDataSeedService, Seed.DemoDataSeedService>();

        services.AddHealthChecks()
            .AddDbContextCheck<WherezItDbContext>("postgresql");

        return services;
    }
}
