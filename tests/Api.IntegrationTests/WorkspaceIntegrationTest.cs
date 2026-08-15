using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Users.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class WorkspaceIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public WorkspaceIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task CreateWorkspace_Succeeds_AndAssignsCreatorOwnerRoleAtomically()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var testUid = $"ws_owner_uid_{Guid.NewGuid():N}";
        var identity = new AuthenticatedIdentity(testUid, "owner@example.com", true);

        var request = new CreateWorkspaceRequestDto("My Home Workspace");
        var result = await workspaceService.CreateWorkspaceAsync(identity, request);

        Assert.NotNull(result);
        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("My Home Workspace", result.Name);
        Assert.Equal("OWNER", result.Role);

        // Verify Database Persistence & Atomicity
        var dbWorkspace = await dbContext.Workspaces
            .Include(w => w.Members)
            .ThenInclude(m => m.User)
            .FirstOrDefaultAsync(w => w.Id == result.Id);

        Assert.NotNull(dbWorkspace);
        Assert.Equal("My Home Workspace", dbWorkspace.Name);
        Assert.Single(dbWorkspace.Members);

        var member = dbWorkspace.Members.First();
        Assert.Equal(Domain.Enums.WorkspaceRole.OWNER, member.Role);
        Assert.Equal(testUid, member.User.FirebaseUid);
    }

    [Fact]
    public async Task GetUserWorkspaces_ReturnsOnlyMembershipsBelongingToCurrentUser()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();

        var userAUid = $"user_a_uid_{Guid.NewGuid():N}";
        var userBUid = $"user_b_uid_{Guid.NewGuid():N}";

        var identityA = new AuthenticatedIdentity(userAUid, "usera@example.com", true);
        var identityB = new AuthenticatedIdentity(userBUid, "userb@example.com", true);

        await workspaceService.CreateWorkspaceAsync(identityA, new CreateWorkspaceRequestDto("User A Workspace 1"));
        await workspaceService.CreateWorkspaceAsync(identityA, new CreateWorkspaceRequestDto("User A Workspace 2"));
        await workspaceService.CreateWorkspaceAsync(identityB, new CreateWorkspaceRequestDto("User B Workspace"));

        var userAWorkspaces = await workspaceService.GetUserWorkspacesAsync(identityA);
        var userBWorkspaces = await workspaceService.GetUserWorkspacesAsync(identityB);

        Assert.Equal(2, userAWorkspaces.Count);
        Assert.All(userAWorkspaces, w => Assert.Contains("User A", w.Name));

        Assert.Single(userBWorkspaces);
        Assert.Equal("User B Workspace", userBWorkspaces[0].Name);
    }

    [Fact]
    public async Task CreateWorkspace_InvalidName_ThrowsArgumentException()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();

        var identity = new AuthenticatedIdentity($"uid_{Guid.NewGuid():N}", "val@example.com", true);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("   ")));

        var name101Chars = new string('A', 101);
        await Assert.ThrowsAsync<ArgumentException>(() =>
            workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto(name101Chars)));
    }

    [Fact]
    public async Task UnauthenticatedWorkspaceRequest_Returns401Unauthorized()
    {
        var client = _fixture.CreateClient();
        var getResponse = await client.GetAsync("/api/v1/workspaces");
        var postResponse = await client.PostAsJsonAsync("/api/v1/workspaces", new { name = "Test" });

        Assert.Equal(HttpStatusCode.Unauthorized, getResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, postResponse.StatusCode);
    }

    [Fact]
    public void Migration_Schema_ContainsExpectedTables()
    {
        using var scope = _fixture.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var tableNames = dbContext.Model.GetEntityTypes().Select(e => e.GetTableName()).ToList();

        Assert.Contains("users", tableNames);
        Assert.Contains("workspaces", tableNames);
        Assert.Contains("workspace_members", tableNames);
        Assert.Equal(3, tableNames.Count);
    }

    [Fact]
    public async Task WorkspaceMember_Cardinality_TestA_SameUser_MultipleWorkspaces_Succeeds()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();

        var identity = new AuthenticatedIdentity($"multi_ws_uid_{Guid.NewGuid():N}", "multi@example.com", true);

        var ws1 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Workspace 1"));
        var ws2 = await workspaceService.CreateWorkspaceAsync(identity, new CreateWorkspaceRequestDto("Workspace 2"));

        Assert.NotEqual(ws1.Id, ws2.Id);

        var workspaces = await workspaceService.GetUserWorkspacesAsync(identity);
        Assert.Equal(2, workspaces.Count);
    }

    [Fact]
    public async Task WorkspaceMember_Cardinality_TestB_SameUser_SameWorkspace_DuplicateInsert_FailsPrimaryKeyConstraint()
    {
        using var scope = _fixture.Services.CreateScope();
        var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identity = new AuthenticatedIdentity($"dup_ws_uid_{Guid.NewGuid():N}", "dup@example.com", true);
        var userDto = await userService.SyncCurrentUserAsync(identity);

        var workspace = new Domain.Entities.Workspace
        {
            Id = Guid.NewGuid(),
            Name = "Single Workspace",
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var member1 = new Domain.Entities.WorkspaceMember
        {
            WorkspaceId = workspace.Id,
            UserId = userDto.Id,
            Role = Domain.Enums.WorkspaceRole.OWNER,
            CreatedAt = DateTimeOffset.UtcNow
        };

        var member2 = new Domain.Entities.WorkspaceMember
        {
            WorkspaceId = workspace.Id,
            UserId = userDto.Id,
            Role = Domain.Enums.WorkspaceRole.MEMBER,
            CreatedAt = DateTimeOffset.UtcNow
        };

        dbContext.Workspaces.Add(workspace);
        dbContext.WorkspaceMembers.Add(member1);
        await dbContext.SaveChangesAsync();

        dbContext.WorkspaceMembers.Add(member2);
        var ex = await Assert.ThrowsAsync<DbUpdateException>(() => dbContext.SaveChangesAsync());
        Assert.NotNull(ex.InnerException);
        Assert.IsType<Npgsql.PostgresException>(ex.InnerException);
        Assert.Equal("23505", ((Npgsql.PostgresException)ex.InnerException).SqlState);
    }

    [Fact]
    public async Task WorkspaceMember_Cardinality_TestC_DifferentUsers_SameWorkspace_Succeeds()
    {
        using var scope = _fixture.Services.CreateScope();
        var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var identityOwner = new AuthenticatedIdentity($"owner_{Guid.NewGuid():N}", "owner@example.com", true);
        var identityMember = new AuthenticatedIdentity($"member_{Guid.NewGuid():N}", "member@example.com", true);

        var userMemberDto = await userService.SyncCurrentUserAsync(identityMember);

        var ws = await workspaceService.CreateWorkspaceAsync(identityOwner, new CreateWorkspaceRequestDto("Shared Workspace"));

        var member2 = new Domain.Entities.WorkspaceMember
        {
            WorkspaceId = ws.Id,
            UserId = userMemberDto.Id,
            Role = Domain.Enums.WorkspaceRole.MEMBER,
            CreatedAt = DateTimeOffset.UtcNow
        };

        dbContext.WorkspaceMembers.Add(member2);
        await dbContext.SaveChangesAsync();

        var members = await dbContext.WorkspaceMembers.Where(m => m.WorkspaceId == ws.Id).ToListAsync();
        Assert.Equal(2, members.Count);
    }
}
