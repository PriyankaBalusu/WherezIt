using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class ContainerConfiguration : IEntityTypeConfiguration<Container>
{
    public void Configure(EntityTypeBuilder<Container> builder)
    {
        builder.ToTable("containers", t =>
        {
            t.HasCheckConstraint("ck_containers_moving_priority", "moving_priority IS NULL OR moving_priority IN ('LOW', 'MEDIUM', 'HIGH')");
        });

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(c => c.WorkspaceId)
            .HasColumnName("workspace_id")
            .IsRequired();

        builder.Property(c => c.StorageNodeId)
            .HasColumnName("storage_node_id")
            .IsRequired();

        builder.Property(c => c.BoxNumber)
            .HasColumnName("box_number")
            .IsRequired();

        builder.Property(c => c.Name)
            .HasColumnName("name")
            .HasMaxLength(100);

        builder.Property(c => c.Description)
            .HasColumnName("description")
            .HasMaxLength(500);

        builder.Property(c => c.DestinationStorageNodeId)
            .HasColumnName("destination_storage_node_id");

        builder.Property(c => c.IsPacked)
            .HasColumnName("is_packed")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(c => c.MovingPriority)
            .HasColumnName("moving_priority")
            .HasMaxLength(20);

        builder.Property(c => c.IsArchived)
            .HasColumnName("is_archived")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.HasOne(c => c.Workspace)
            .WithMany()
            .HasForeignKey(c => c.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Composite Foreign Key to StorageNode enforcing same workspace
        builder.HasOne(c => c.StorageNode)
            .WithMany()
            .HasForeignKey(c => new { c.WorkspaceId, c.StorageNodeId })
            .HasPrincipalKey(n => new { n.WorkspaceId, n.Id })
            .OnDelete(DeleteBehavior.Restrict);

        // Composite Foreign Key to Destination StorageNode enforcing same workspace
        builder.HasOne(c => c.DestinationStorageNode)
            .WithMany()
            .HasForeignKey(c => new { c.WorkspaceId, c.DestinationStorageNodeId })
            .HasPrincipalKey(n => new { n.WorkspaceId, n.Id })
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(c => new { c.WorkspaceId, c.Id })
            .IsUnique()
            .HasDatabaseName("ix_containers_workspace_id_id");

        builder.HasIndex(c => new { c.WorkspaceId, c.BoxNumber })
            .IsUnique()
            .HasDatabaseName("ix_containers_workspace_id_box_number");

        builder.HasIndex(c => new { c.WorkspaceId, c.StorageNodeId })
            .HasDatabaseName("ix_containers_workspace_id_storage_node_id");

        builder.HasIndex(c => new { c.WorkspaceId, c.DestinationStorageNodeId })
            .HasDatabaseName("ix_containers_workspace_id_destination_storage_node_id");
    }
}
