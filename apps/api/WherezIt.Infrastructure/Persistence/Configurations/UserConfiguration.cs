using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(u => u.FirebaseUid)
            .HasColumnName("firebase_uid")
            .HasMaxLength(128)
            .IsRequired();

        builder.HasIndex(u => u.FirebaseUid)
            .IsUnique()
            .HasDatabaseName("ix_users_firebase_uid");

        builder.Property(u => u.Email)
            .HasColumnName("email")
            .HasMaxLength(256)
            .IsRequired(false);

        builder.Property(u => u.EmailVerified)
            .HasColumnName("email_verified")
            .IsRequired();

        builder.Property(u => u.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(u => u.UpdatedAt)
            .HasColumnName("updated_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();
    }
}
