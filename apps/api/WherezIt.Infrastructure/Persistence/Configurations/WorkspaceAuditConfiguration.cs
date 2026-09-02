using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class WorkspaceAuditConfiguration : IEntityTypeConfiguration<WorkspaceAudit>
{
    public void Configure(EntityTypeBuilder<WorkspaceAudit> builder)
    {
        builder.ToTable("workspace_audits", t =>
        {
            t.HasCheckConstraint("ck_workspace_audits_event_type", "event_type IN ('WORKSPACE_CREATED', 'WORKSPACE_RENAMED', 'WORKSPACE_DELETED', 'LOCATION_CREATED', 'LOCATION_RENAMED', 'LOCATION_DELETED')");
        });

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(a => a.WorkspaceId)
            .HasColumnName("workspace_id")
            .IsRequired();

        builder.Property(a => a.WorkspaceName)
            .HasColumnName("workspace_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(a => a.InventoryNamespaceId)
            .HasColumnName("inventory_namespace_id")
            .IsRequired();

        builder.Property(a => a.EventType)
            .HasColumnName("event_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(a => a.ActorUserId)
            .HasColumnName("actor_user_id")
            .HasMaxLength(128)
            .IsRequired();

        builder.Property(a => a.AllowedUserIds)
            .HasColumnName("allowed_user_ids")
            .HasMaxLength(2000)
            .IsRequired();

        builder.Property(a => a.OccurredAt)
            .HasColumnName("occurred_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(a => a.DetailsJson)
            .HasColumnName("details_json")
            .HasColumnType("jsonb");

        builder.HasOne<InventoryNamespace>()
            .WithMany()
            .HasForeignKey(a => a.InventoryNamespaceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => new { a.InventoryNamespaceId, a.OccurredAt })
            .HasDatabaseName("ix_workspace_audits_namespace_occurred");

        builder.HasIndex(a => new { a.WorkspaceId, a.OccurredAt })
            .HasDatabaseName("ix_workspace_audits_workspace_occurred");
    }
}
