using Microsoft.EntityFrameworkCore;
using WherezIt.Application.Containers.Services;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class PostgreSqlBoxNumberAllocator : IBoxNumberAllocator
{
    private readonly WherezItDbContext _dbContext;

    public PostgreSqlBoxNumberAllocator(WherezItDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<int> AllocateNextAsync(Guid workspaceId, CancellationToken cancellationToken = default)
    {
        // 1. Concurrency-safe lazy initialization (ON CONFLICT DO NOTHING)
        await _dbContext.Database.ExecuteSqlRawAsync(
            @"INSERT INTO workspace_box_counters (workspace_id, next_box_number)
              VALUES ({0}, 1)
              ON CONFLICT (workspace_id) DO NOTHING;",
            new object[] { workspaceId },
            cancellationToken);

        // 2. Atomic update returning current next_box_number then incrementing
        var result = await _dbContext.Database.SqlQueryRaw<int>(
            @"UPDATE workspace_box_counters
              SET next_box_number = next_box_number + 1
              WHERE workspace_id = {0}
              RETURNING next_box_number - 1;",
            new object[] { workspaceId })
            .ToListAsync(cancellationToken);

        return result.Single();
    }
}
