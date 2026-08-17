using Microsoft.Extensions.DependencyInjection;
using WherezIt.Api.IntegrationTests.Fixtures;
using WherezIt.Application.Authentication;
using WherezIt.Application.Users.Services;
using WherezIt.Application.Workspaces.Dtos;
using WherezIt.Application.Workspaces.Services;
using WherezIt.Domain.Entities;
using WherezIt.Domain.Enums;
using WherezIt.Infrastructure.Persistence;
using Xunit;

namespace WherezIt.Api.IntegrationTests;

public class WorkspaceAuthorizationIntegrationTest : IClassFixture<PostgresTestFixture>
{
    private readonly PostgresTestFixture _fixture;

    public WorkspaceAuthorizationIntegrationTest(PostgresTestFixture fixture)
    {
        _fixture = fixture;
    }

    [Fact]
    public async Task WorkspaceMember_OwnerAndMember_PassesAuthorization()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
        var authService = scope.ServiceProvider.GetRequiredService<IWorkspaceAuthorizationService>();
        var dbContext = scope.ServiceProvider.GetRequiredService<WherezItDbContext>();

        var ownerIdentity = new AuthenticatedIdentity($"owner_auth_{Guid.NewGuid():N}", "owner@auth.com", true);
        var memberIdentity = new AuthenticatedIdentity($"member_auth_{Guid.NewGuid():N}", "member@auth.com", true);

        var ownerUser = await userService.SyncCurrentUserAsync(ownerIdentity);
        var memberUser = await userService.SyncCurrentUserAsync(memberIdentity);

        var workspace = await workspaceService.CreateWorkspaceAsync(ownerIdentity, new CreateWorkspaceRequestDto("Auth Test WS"));

        // Add memberUser as MEMBER
        var memberRecord = new WorkspaceMember
        {
            WorkspaceId = workspace.Id,
            UserId = memberUser.Id,
            Role = WorkspaceRole.MEMBER,
            CreatedAt = DateTimeOffset.UtcNow
        };
        dbContext.WorkspaceMembers.Add(memberRecord);
        await dbContext.SaveChangesAsync();

        // Verify OWNER access
        var isOwnerMember = await authService.IsWorkspaceMemberAsync(ownerIdentity, workspace.Id);
        Assert.True(isOwnerMember);
        await authService.RequireWorkspaceMembershipAsync(ownerIdentity, workspace.Id);

        // Verify MEMBER access
        var isMemberMember = await authService.IsWorkspaceMemberAsync(memberIdentity, workspace.Id);
        Assert.True(isMemberMember);
        await authService.RequireWorkspaceMembershipAsync(memberIdentity, workspace.Id);
    }

    [Fact]
    public async Task NonMember_FailsAuthorization_ThrowsUnauthorizedAccessException()
    {
        using var scope = _fixture.Services.CreateScope();
        var workspaceService = scope.ServiceProvider.GetRequiredService<IWorkspaceService>();
        var authService = scope.ServiceProvider.GetRequiredService<IWorkspaceAuthorizationService>();

        var userAIdentity = new AuthenticatedIdentity($"user_a_auth_{Guid.NewGuid():N}", "usera@auth.com", true);
        var userBIdentity = new AuthenticatedIdentity($"user_b_auth_{Guid.NewGuid():N}", "userb@auth.com", true);

        var wsA = await workspaceService.CreateWorkspaceAsync(userAIdentity, new CreateWorkspaceRequestDto("User A Private WS"));

        var isMember = await authService.IsWorkspaceMemberAsync(userBIdentity, wsA.Id);
        Assert.False(isMember);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            authService.RequireWorkspaceMembershipAsync(userBIdentity, wsA.Id));
    }
}
