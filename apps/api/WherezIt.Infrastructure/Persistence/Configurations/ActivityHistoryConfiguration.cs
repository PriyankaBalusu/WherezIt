using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class ActivityHistoryConfiguration : IEntityTypeConfiguration<ActivityHistory>
{
    public void Configure(EntityTypeBuilder<ActivityHistory> builder)
    {
        builder.ToTable("activity_histories", t =>
        {
            t.HasCheckConstraint("ck_activity_histories_activity_type", "activity_type = 'CONTAINER_MOVED'");
        });

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(a => a.WorkspaceId)
            .HasColumnName("workspace_id")
            .IsRequired();

        builder.Property(a => a.ActorUserId)
            .HasColumnName("actor_user_id")
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(a => a.ActivityType)
            .HasColumnName("activity_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(a => a.ContainerId)
            .HasColumnName("container_id")
            .IsRequired();

        builder.Property(a => a.PreviousStorageNodeId)
            .HasColumnName("previous_storage_node_id");

        builder.Property(a => a.DestinationStorageNodeId)
            .HasColumnName("destination_storage_node_id");

        builder.Property(a => a.PreviousLocationDisplay)
            .HasColumnName("previous_location_display")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(a => a.DestinationLocationDisplay)
            .HasColumnName("destination_location_display")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(a => a.OccurredAt)
            .HasColumnName("occurred_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        // Workspace relationship
        builder.HasOne(a => a.Workspace)
            .WithMany()
            .HasForeignKey(a => a.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Container relationship (composite FK enforcing same workspace)
        builder.HasOne(a => a.Container)
            .WithMany()
            .HasForeignKey(a => new { a.WorkspaceId, a.ContainerId })
            .HasPrincipalKey(c => new { c.WorkspaceId, c.Id })
            .OnDelete(DeleteBehavior.Cascade);

        // Previous StorageNode relationship (composite FK enforcing same workspace, SET NULL on node deletion)
        builder.HasOne(a => a.PreviousStorageNode)
            .WithMany()
            .HasForeignKey(a => new { a.WorkspaceId, a.PreviousStorageNodeId })
            .HasPrincipalKey(s => new { s.WorkspaceId, s.Id })
            .OnDelete(DeleteBehavior.SetNull);

        // Destination StorageNode relationship (composite FK enforcing same workspace, SET NULL on node deletion)
        builder.HasOne(a => a.DestinationStorageNode)
            .WithMany()
            .HasForeignKey(a => new { a.WorkspaceId, a.DestinationStorageNodeId })
            .HasPrincipalKey(s => new { s.WorkspaceId, s.Id })
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(a => new { a.WorkspaceId, a.ContainerId, a.OccurredAt })
            .HasDatabaseName("ix_activity_histories_workspace_container_occurred");
    }
}
