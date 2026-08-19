using System;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Containers.Dtos;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Items.Dtos;
using WherezIt.Application.Items.Services;
using WherezIt.Application.StorageLocations.Dtos;
using WherezIt.Application.StorageLocations.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class ItemCategoryIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public ItemCategoryIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task ItemCategory_CreateUpdateNormalizeValidateAndTenantSecurity_Succeeds()
    {
        using var scope = _fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var locationService = scope.ServiceProvider.GetRequiredService<IStorageLocationService>();
        var containerService = scope.ServiceProvider.GetRequiredService<IContainerService>();
        var itemService = scope.ServiceProvider.GetRequiredService<IItemService>();

        var userA = new AuthenticatedIdentity("user-cat-1", "usera@cat.test", true);
        var userB = new AuthenticatedIdentity("user-cat-2", "userb@cat.test", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(userA, new CreateWorkspaceRequestDto("Cat Workspace A"));
        var wsB = await workspaceService.CreateWorkspaceAsync(userB, new CreateWorkspaceRequestDto("Cat Workspace B"));

        var locA = await locationService.CreateLocationAsync(userA, wsA.Id, new CreateStorageLocationRequestDto("Loc A", null));
        var containerA = await containerService.CreateContainerAsync(userA, wsA.Id, new CreateContainerRequestDto(locA.Id, "Box Cat A", "Desc A"));

        // 1. Create item without category -> null
        var itemNoCat = await itemService.CreateItemAsync(userA, wsA.Id, containerA.Id, new CreateItemRequestDto("Light Bulb", 2));
        Assert.Null(itemNoCat.Category);
        Assert.Equal("MANUAL", itemNoCat.Source);
        Assert.True(itemNoCat.IsVerified);

        // 2. Create item with category and whitespace -> trimmed & display casing preserved
        var itemWithCat = await itemService.CreateItemAsync(userA, wsA.Id, containerA.Id, new CreateItemRequestDto("Christmas Lights", 1, "  Holiday Decor  "));
        Assert.Equal("Holiday Decor", itemWithCat.Category);
        Assert.Equal("MANUAL", itemWithCat.Source);
        Assert.True(itemWithCat.IsVerified);

        // 3. Category >50 chars rejected
        var longCat = new string('A', 51);
        await Assert.ThrowsAsync<ArgumentException>(async () =>
            await itemService.CreateItemAsync(userA, wsA.Id, containerA.Id, new CreateItemRequestDto("Bad Item", 1, longCat)));

        // 4. Update item category -> update succeeds, category normalized
        var updatedCat = await itemService.UpdateItemAsync(userA, wsA.Id, itemNoCat.Id, new UpdateItemRequestDto(null, null, "Electrical"));
        Assert.Equal("Electrical", updatedCat.Category);

        // 5. Clear item category -> empty string normalizes to null
        var clearedCat = await itemService.UpdateItemAsync(userA, wsA.Id, updatedCat.Id, new UpdateItemRequestDto(null, null, "   "));
        Assert.Null(clearedCat.Category);

        // 6. Tenant isolation: userB cannot update item in wsA
        await Assert.ThrowsAsync<UnauthorizedAccessException>(async () =>
            await itemService.UpdateItemAsync(userB, wsA.Id, itemWithCat.Id, new UpdateItemRequestDto(null, null, "Hacked")));

        // 7. Tenant isolation: cross-workspace itemId access returns KeyNotFound
        await Assert.ThrowsAsync<KeyNotFoundException>(async () =>
            await itemService.UpdateItemAsync(userA, wsB.Id, itemWithCat.Id, new UpdateItemRequestDto(null, null, "CrossWS")));
    }
}
