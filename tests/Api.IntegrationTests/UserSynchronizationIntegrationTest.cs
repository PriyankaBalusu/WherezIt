using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Users.Dtos;
using WherezIt.Application.Users.Services;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class UserSynchronizationIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public UserSynchronizationIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task FirstAuthenticatedSync_CreatesUsersRowInPostgres()
    {
        using var scope = _fixture.Services.CreateScope();
        var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = $"test_uid_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(testUid, "first@example.com", true);

        var result = await userService.SyncCurrentUserAsync(identity);

        Assert.NotNull(result);
        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal(testUid, result.FirebaseUid);
        Assert.Equal("first@example.com", result.Email);
        Assert.True(result.EmailVerified);

        var dbUser = await dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.FirebaseUid == testUid);
        Assert.NotNull(dbUser);
        Assert.Equal(result.Id, dbUser.Id);
    }

    [Fact]
    public async Task SubsequentSync_ReturnsExistingUser_WithoutCreatingDuplicates()
    {
        using var scope = _fixture.Services.CreateScope();
        var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = $"test_uid_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(testUid, "repeat@example.com", true);

        var firstResult = await userService.SyncCurrentUserAsync(identity);
        var secondResult = await userService.SyncCurrentUserAsync(identity);

        Assert.Equal(firstResult.Id, secondResult.Id);
        Assert.Equal(firstResult.CreatedAt, secondResult.CreatedAt);

        var userCount = await dbContext.Users.CountAsync(u => u.FirebaseUid == testUid);
        Assert.Equal(1, userCount);
    }

    [Fact]
    public async Task DatabaseUniqueConstraint_PreventsDuplicateFirebaseUid()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = $"test_uid_{Guid.NewGuid():N}";
        var now = DateTimeOffset.UtcNow;

        var user1 = new Domain.Entities.User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = testUid,
            Email = "u1@example.com",
            EmailVerified = true,
            CreatedAt = now,
            UpdatedAt = now
        };

        var user2 = new Domain.Entities.User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = testUid,
            Email = "u2@example.com",
            EmailVerified = false,
            CreatedAt = now,
            UpdatedAt = now
        };

        dbContext.Users.Add(user1);
        await dbContext.SaveChangesAsync();

        dbContext.Users.Add(user2);
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
        Assert.NotNull(ex.InnerException);
    }

    [Fact]
    public async Task ConcurrentFirstUse_Synchronization_ProducesExactlyOneUsersRow()
    {
        var testUid = $"concurrent_uid_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(testUid, "concurrent@example.com", true);

        const int concurrencyDegree = 10;
        var tasks = Enumerable.Range(0, concurrencyDegree).Select(async _ =>
        {
            using var scope = _fixture.Services.CreateScope();
            var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
            return await userService.SyncCurrentUserAsync(identity);
        });

        var results = await Task.WhenAll(tasks);

        Assert.Equal(concurrencyDegree, results.Length);
        var firstId = results[0].Id;
        Assert.All(results, r => Assert.Equal(firstId, r.Id));

        using var verifyScope = _fixture.Services.CreateScope();
        var dbContext = verifyScope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var userCount = await dbContext.Users.CountAsync(u => u.FirebaseUid == testUid);
        Assert.Equal(1, userCount);
    }

    [Fact]
    public async Task MetadataUpdate_ChangedEmail_UpdatesRow_WithoutCreatingDuplicate()
    {
        using var scope = _fixture.Services.CreateScope();
        var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = $"test_uid_{Guid.NewGuid():N}";
        var initialIdentity = new AuthenticatedIdentity(testUid, "old@example.com", false);

        var firstResult = await userService.SyncCurrentUserAsync(initialIdentity);
        await Task.Delay(10); // Ensure timestamp difference if clock resolution is low

        var updatedIdentity = new AuthenticatedIdentity(testUid, "new@example.com", true);
        var secondResult = await userService.SyncCurrentUserAsync(updatedIdentity);

        Assert.Equal(firstResult.Id, secondResult.Id);
        Assert.Equal("new@example.com", secondResult.Email);
        Assert.True(secondResult.EmailVerified);
        Assert.True(secondResult.UpdatedAt >= firstResult.UpdatedAt);

        var userCount = await dbContext.Users.CountAsync(u => u.FirebaseUid == testUid);
        Assert.Equal(1, userCount);
    }

    [Fact]
    public async Task UnchangedMetadata_DoesNotMutateUpdatedAtTimestamp()
    {
        using var scope = _fixture.Services.CreateScope();
        var userService = scope.ServiceProvider.GetRequiredService<IUserService>();

        var testUid = $"test_uid_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(testUid, "same@example.com", true);

        var firstResult = await userService.SyncCurrentUserAsync(identity);
        var secondResult = await userService.SyncCurrentUserAsync(identity);

        Assert.Equal(firstResult.UpdatedAt, secondResult.UpdatedAt);
    }

    [Fact]
    public async Task MissingTrustedUid_ThrowsArgumentException()
    {
        using var scope = _fixture.Services.CreateScope();
        var userService = scope.ServiceProvider.GetRequiredService<IUserService>();

        var invalidIdentity = new AuthenticatedIdentity("", "invalid@example.com", false);

        await Assert.ThrowsAsync<ArgumentException>(() => userService.SyncCurrentUserAsync(invalidIdentity));
    }

    [Fact]
    public async Task UnauthenticatedRequest_Returns401Unauthorized()
    {
        var client = _fixture.CreateClient();
        var response = await client.GetAsync("/api/v1/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public void Migration_Schema_ContainsOnlyUsersTable()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var entityTypes = dbContext.Model.GetEntityTypes().Select(e => e.GetTableName()).ToList();

        Assert.Single(entityTypes);
        Assert.Equal("users", entityTypes[0]);
    }
}
