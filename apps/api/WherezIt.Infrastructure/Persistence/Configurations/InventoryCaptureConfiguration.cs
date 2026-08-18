using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class InventoryCaptureConfiguration : IEntityTypeConfiguration<InventoryCapture>
{
    public void Configure(EntityTypeBuilder<InventoryCapture> builder)
    {
        builder.ToTable("inventory_captures", t =>
        {
            t.HasCheckConstraint("CK_inventory_captures_status_valid",
                "status IN ('UPLOADED', 'QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'CONFIRMED', 'FAILED')");
        });

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id");

        builder.Property(x => x.WorkspaceId)
            .HasColumnName("workspace_id")
            .IsRequired();

        builder.Property(x => x.ContainerId)
            .HasColumnName("container_id")
            .IsRequired();

        builder.Property(x => x.ImageAssetId)
            .HasColumnName("image_asset_id")
            .IsRequired();

        builder.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        builder.HasAlternateKey(x => new { x.WorkspaceId, x.Id })
            .HasName("ix_inventory_captures_workspace_id_id");

        builder.HasIndex(x => new { x.WorkspaceId, x.ImageAssetId })
            .IsUnique()
            .HasDatabaseName("ix_inventory_captures_workspace_image");

        builder.HasOne(x => x.Container)
            .WithMany()
            .HasPrincipalKey(c => new { c.WorkspaceId, c.Id })
            .HasForeignKey(x => new { x.WorkspaceId, x.ContainerId })
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(x => x.ImageAsset)
            .WithMany()
            .HasPrincipalKey(a => new { a.WorkspaceId, a.Id })
            .HasForeignKey(x => new { x.WorkspaceId, x.ImageAssetId })
            .OnDelete(DeleteBehavior.Restrict);
    }
}
