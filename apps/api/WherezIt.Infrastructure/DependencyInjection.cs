using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
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

        services.AddScoped<WherezIt.Application.Users.Services.IUserService, Services.UserService>();
        services.AddScoped<WherezIt.Application.Workspaces.Services.IWorkspaceService, Services.WorkspaceService>();
        services.AddScoped<WherezIt.Application.Workspaces.Services.IWorkspaceAuthorizationService, Services.WorkspaceAuthorizationService>();
        services.AddScoped<WherezIt.Application.StorageLocations.Services.IStorageLocationService, Services.StorageLocationService>();
        services.AddScoped<WherezIt.Application.StorageLocations.Services.ILocationMoveService, Services.LocationMoveService>();
        services.AddScoped<WherezIt.Application.StorageLocations.Services.IBreadcrumbService, Services.BreadcrumbService>();
        services.AddScoped<WherezIt.Application.Containers.Services.IBoxNumberAllocator, Services.PostgreSqlBoxNumberAllocator>();
        services.AddScoped<WherezIt.Application.Containers.Services.IContainerService, Services.ContainerService>();
        services.AddScoped<WherezIt.Application.Containers.Services.IContainerMoveService, Services.ContainerMoveService>();
        services.AddScoped<WherezIt.Application.Items.Services.IItemService, Services.ItemService>();
        services.AddSingleton<WherezIt.Application.Storage.Services.IImageObjectStorage, Services.LocalDevImageObjectStorage>();

        services.AddHealthChecks()
            .AddDbContextCheck<WherezItDbContext>("postgresql");

        return services;
    }
}
