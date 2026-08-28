using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class WorkspaceConfiguration : IEntityTypeConfiguration<Workspace>
{
    public void Configure(EntityTypeBuilder<Workspace> builder)
    {
        builder.ToTable("workspaces");

        builder.HasKey(w => w.Id);

        builder.Property(w => w.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(w => w.Name)
            .HasColumnName("name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(w => w.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(w => w.UpdatedAt)
            .HasColumnName("updated_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.Property(w => w.InventoryNamespaceId)
            .HasColumnName("inventory_namespace_id")
            .IsRequired();

        builder.HasOne(w => w.InventoryNamespace)
            .WithMany(n => n.Workspaces)
            .HasForeignKey(w => w.InventoryNamespaceId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(w => w.InventoryNamespaceId)
            .HasDatabaseName("ix_workspaces_inventory_namespace_id");

        builder.HasAlternateKey(w => new { w.InventoryNamespaceId, w.Id })
            .HasName("ak_workspaces_inventory_namespace_id_id");
    }
}
