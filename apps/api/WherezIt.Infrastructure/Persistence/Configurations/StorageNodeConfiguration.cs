using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class StorageNodeConfiguration : IEntityTypeConfiguration<StorageNode>
{
    public void Configure(EntityTypeBuilder<StorageNode> builder)
    {
        builder.ToTable("storage_nodes");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(n => n.WorkspaceId)
            .HasColumnName("workspace_id")
            .IsRequired();

        builder.Property(n => n.ParentId)
            .HasColumnName("parent_id");

        builder.Property(n => n.Name)
            .HasColumnName("name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(n => n.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(n => n.UpdatedAt)
            .HasColumnName("updated_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        // Foreign key to Workspace (CASCADE delete)
        builder.HasOne(n => n.Workspace)
            .WithMany()
            .HasForeignKey(n => n.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Unique composite key required as principal target for composite self-referencing FK
        builder.HasIndex(n => new { n.WorkspaceId, n.Id })
            .IsUnique()
            .HasDatabaseName("ix_storage_nodes_workspace_id_id");

        // Composite Self-Referencing Foreign Key enforcing SAME-WORKSPACE parentage at DB level
        builder.HasOne(n => n.Parent)
            .WithMany(n => n.Children)
            .HasForeignKey(n => new { n.WorkspaceId, n.ParentId })
            .HasPrincipalKey(n => new { n.WorkspaceId, n.Id })
            .OnDelete(DeleteBehavior.Restrict);

        // Index for hierarchical parent lookups (WHERE workspace_id = ? AND parent_id = ?)
        builder.HasIndex(n => new { n.WorkspaceId, n.ParentId })
            .HasDatabaseName("ix_storage_nodes_workspace_id_parent_id");
    }
}
