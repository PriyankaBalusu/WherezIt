using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Containers.Services;
using WherezIt.Application.Containers.Utils;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class BoxNumberAllocatorConcurrencyTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public BoxNumberAllocatorConcurrencyTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Theory]
    [InlineData(1, "BOX 001")]
    [InlineData(9, "BOX 009")]
    [InlineData(10, "BOX 010")]
    [InlineData(99, "BOX 099")]
    [InlineData(100, "BOX 100")]
    [InlineData(999, "BOX 999")]
    [InlineData(1000, "BOX 1000")]
    [InlineData(12500, "BOX 12500")]
    public void BoxIdFormatter_FormatsNumbersCorrectly(int inputNumber, string expectedFormatted)
    {
        var formatted = BoxIdFormatter.Format(inputNumber);
        Assert.Equal(expectedFormatted, formatted);
    }

    [Fact]
    public async Task AllocateNextAsync_ConcurrentInitializationAndAllocation_ReturnsUniqueNumbers()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var workspace = new Workspace
        {
            Id = Guid.NewGuid(),
            Name = "Concurrency WS",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        dbContext.Workspaces.Add(workspace);
        await dbContext.SaveChangesAsync();

        // Verify counter row does NOT exist initially
        var initialCounter = await dbContext.WorkspaceBoxCounters.FirstOrDefaultAsync(c => c.WorkspaceId == workspace.Id);
        Assert.Null(initialCounter);

        const int concurrentTasksCount = 20;
        var tasks = Enumerable.Range(0, concurrentTasksCount).Select(async _ =>
        {
            using var taskScope = _fixture.Services.CreateScope();
            var allocator = taskScope.ServiceProvider.GetRequiredService<IBoxNumberAllocator>();
            return await allocator.AllocateNextAsync(workspace.Id);
        }).ToArray();

        var results = await Task.WhenAll(tasks);

        Assert.Equal(concurrentTasksCount, results.Length);

        // Verify all 20 returned numbers are unique
        var uniqueNumbers = results.Distinct().ToList();
        Assert.Equal(concurrentTasksCount, uniqueNumbers.Count);

        // Under isolated successful test, numbers should be 1 through 20
        var sortedNumbers = results.OrderBy(n => n).ToList();
        Assert.Equal(Enumerable.Range(1, concurrentTasksCount), sortedNumbers);

        // Verify counter state in database equals 21
        using var verifyScope = _fixture.Services.CreateScope();
        var verifyDbContext = verifyScope.ServiceProvider.GetRequiredService<WherezItDbContext>();
        var finalCounter = await verifyDbContext.WorkspaceBoxCounters.FirstOrDefaultAsync(c => c.WorkspaceId == workspace.Id);

        Assert.NotNull(finalCounter);
        Assert.Equal(21, finalCounter.NextBoxNumber);
    }

    [Fact]
    public async Task AllocateNextAsync_MultipleWorkspaces_MaintainIndependentCounters()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var wsA = new Workspace { Id = Guid.NewGuid(), Name = "WS Alpha", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        var wsB = new Workspace { Id = Guid.NewGuid(), Name = "WS Beta", CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        dbContext.Workspaces.AddRange(wsA, wsB);
        await dbContext.SaveChangesAsync();

        var allocator = scope.ServiceProvider.GetRequiredService<IBoxNumberAllocator>();

        var numA1 = await allocator.AllocateNextAsync(wsA.Id);
        var numB1 = await allocator.AllocateNextAsync(wsB.Id);
        var numA2 = await allocator.AllocateNextAsync(wsA.Id);
        var numB2 = await allocator.AllocateNextAsync(wsB.Id);

        Assert.Equal(1, numA1);
        Assert.Equal(1, numB1);
        Assert.Equal(2, numA2);
        Assert.Equal(2, numB2);
    }
}
