using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class ImageAssetConfiguration : IEntityTypeConfiguration<ImageAsset>
{
    public void Configure(EntityTypeBuilder<ImageAsset> builder)
    {
        builder.ToTable("image_assets", t =>
        {
            t.HasCheckConstraint("CK_image_assets_status_valid", "status IN ('PENDING', 'READY', 'FAILED')");
            t.HasCheckConstraint("CK_image_assets_size_positive", "size_bytes > 0");
        });

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id");

        builder.Property(x => x.WorkspaceId)
            .HasColumnName("workspace_id")
            .IsRequired();

        builder.Property(x => x.ContainerId)
            .HasColumnName("container_id");

        builder.Property(x => x.ObjectPath)
            .HasColumnName("object_path")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(x => x.ContentType)
            .HasColumnName("content_type")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(x => x.SizeBytes)
            .HasColumnName("size_bytes")
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
            .HasName("ix_image_assets_workspace_id_id");

        builder.HasOne(x => x.Container)
            .WithMany()
            .HasPrincipalKey(c => new { c.WorkspaceId, c.Id })
            .HasForeignKey(x => new { x.WorkspaceId, x.ContainerId })
            .OnDelete(DeleteBehavior.Restrict)
            .IsRequired(false);
    }
}
