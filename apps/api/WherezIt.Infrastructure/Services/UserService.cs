using Microsoft.EntityFrameworkCore;
using Npgsql;
using WherezIt.Application.Authentication;
using WherezIt.Application.Users.Dtos;
using WherezIt.Application.Users.Services;
using WherezIt.Domain.Entities;
using WherezIt.Infrastructure.Persistence;

namespace WherezIt.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly WherezItDbContext _dbContext;

    public UserService(WherezItDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<UserResponseDto> SyncCurrentUserAsync(AuthenticatedIdentity identity, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(identity.FirebaseUid))
        {
            throw new ArgumentException("Firebase UID cannot be empty.", nameof(identity));
        }

        var existingUser = await _dbContext.Users
            .FirstOrDefaultAsync(u => u.FirebaseUid == identity.FirebaseUid, cancellationToken);

        if (existingUser != null)
        {
            return await UpdateUserMetadataIfChangedAsync(existingUser, identity, cancellationToken);
        }

        var now = DateTimeOffset.UtcNow;
        var newUser = new User
        {
            Id = Guid.NewGuid(),
            FirebaseUid = identity.FirebaseUid,
            Email = identity.Email,
            EmailVerified = identity.EmailVerified,
            CreatedAt = now,
            UpdatedAt = now
        };

        _dbContext.Users.Add(newUser);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapToDto(newUser);
        }
        catch (DbUpdateException ex) when (IsFirebaseUidUniqueViolation(ex))
        {
            _dbContext.Entry(newUser).State = EntityState.Detached;

            var reQueriedUser = await _dbContext.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.FirebaseUid == identity.FirebaseUid, cancellationToken);

            if (reQueriedUser == null)
            {
                throw new InvalidOperationException("Failed to recover user after unique constraint violation.", ex);
            }

            return await UpdateUserMetadataIfChangedAsync(reQueriedUser, identity, cancellationToken);
        }
    }

    private static bool IsFirebaseUidUniqueViolation(DbUpdateException ex)
    {
        if (ex.InnerException is PostgresException postgresEx)
        {
            if (postgresEx.SqlState == PostgresErrorCodes.UniqueViolation)
            {
                if (!string.IsNullOrEmpty(postgresEx.ConstraintName) &&
                    postgresEx.ConstraintName.Equals("ix_users_firebase_uid", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (postgresEx.MessageText != null &&
                    postgresEx.MessageText.Contains("firebase_uid", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private async Task<UserResponseDto> UpdateUserMetadataIfChangedAsync(
        User user,
        AuthenticatedIdentity identity,
        CancellationToken cancellationToken)
    {
        bool hasChanges = false;

        if (user.Email != identity.Email)
        {
            user.Email = identity.Email;
            hasChanges = true;
        }

        if (user.EmailVerified != identity.EmailVerified)
        {
            user.EmailVerified = identity.EmailVerified;
            hasChanges = true;
        }

        if (hasChanges)
        {
            user.UpdatedAt = DateTimeOffset.UtcNow;

            if (_dbContext.Entry(user).State == EntityState.Detached)
            {
                _dbContext.Users.Update(user);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return MapToDto(user);
    }

    private static UserResponseDto MapToDto(User user)
    {
        return new UserResponseDto(
            user.Id,
            user.FirebaseUid,
            user.Email,
            user.EmailVerified,
            user.CreatedAt,
            user.UpdatedAt
        );
    }
}
