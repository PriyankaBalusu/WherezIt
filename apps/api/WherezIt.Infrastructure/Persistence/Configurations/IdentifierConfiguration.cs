using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class IdentifierConfiguration : IEntityTypeConfiguration<Identifier>
{
    public void Configure(EntityTypeBuilder<Identifier> builder)
    {
        builder.ToTable("identifiers", t =>
        {
            t.HasCheckConstraint("ck_identifiers_type", "type IN ('QR', 'BARCODE')");
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

        builder.Property(i => i.Type)
            .HasColumnName("type")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(i => i.Value)
            .HasColumnName("value")
            .HasMaxLength(200)
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

        // Same-workspace composite FK to Container
        builder.HasOne(i => i.Container)
            .WithMany()
            .HasForeignKey(i => new { i.WorkspaceId, i.ContainerId })
            .HasPrincipalKey(c => new { c.WorkspaceId, c.Id })
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(i => i.Value)
            .IsUnique()
            .HasDatabaseName("ix_identifiers_value");

        builder.HasIndex(i => new { i.WorkspaceId, i.ContainerId })
            .HasDatabaseName("ix_identifiers_workspace_id_container_id");
    }
}
