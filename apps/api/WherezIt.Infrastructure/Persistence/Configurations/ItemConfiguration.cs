using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class ItemConfiguration : IEntityTypeConfiguration<Item>
{
    public void Configure(EntityTypeBuilder<Item> builder)
    {
        builder.ToTable("items", t =>
        {
            t.HasCheckConstraint("CK_items_quantity_positive", "quantity >= 1");
            t.HasCheckConstraint("CK_items_source_valid", "source IN ('MANUAL', 'AI_CONFIRMED')");
        });

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(i => i.WorkspaceId)
            .HasColumnName("workspace_id")
            .IsRequired();

        builder.Property(i => i.ContainerId)
            .HasColumnName("container_id")
            .IsRequired();

        builder.Property(i => i.Name)
            .HasColumnName("name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(i => i.Quantity)
            .HasColumnName("quantity")
            .HasDefaultValue(1)
            .IsRequired();

        builder.Property(i => i.Source)
            .HasColumnName("source")
            .HasMaxLength(20)
            .ValueGeneratedNever()
            .IsRequired();

        builder.Property(i => i.IsVerified)
            .HasColumnName("is_verified")
            .ValueGeneratedNever()
            .IsRequired();

        builder.Property(i => i.IsArchived)
            .HasColumnName("is_archived")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(i => i.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(i => i.UpdatedAt)
            .HasColumnName("updated_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.HasOne(i => i.Workspace)
            .WithMany()
            .HasForeignKey(i => i.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Composite Foreign Key to Container enforcing same workspace
        builder.HasOne(i => i.Container)
            .WithMany()
            .HasForeignKey(i => new { i.WorkspaceId, i.ContainerId })
            .HasPrincipalKey(c => new { c.WorkspaceId, c.Id })
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(i => new { i.WorkspaceId, i.ContainerId })
            .HasDatabaseName("ix_items_workspace_id_container_id");
    }
}
