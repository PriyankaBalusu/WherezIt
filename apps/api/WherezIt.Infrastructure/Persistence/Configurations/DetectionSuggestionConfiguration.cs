using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class DetectionSuggestionConfiguration : IEntityTypeConfiguration<DetectionSuggestion>
{
    public void Configure(EntityTypeBuilder<DetectionSuggestion> builder)
    {
        builder.ToTable("detection_suggestions", t =>
        {
            t.HasCheckConstraint("CK_detection_suggestions_quantity_positive", "quantity >= 1");
            t.HasCheckConstraint("CK_detection_suggestions_confidence_range", "confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)");
        });

        builder.HasKey(x => x.Id);

        builder.Property(x => x.Id)
            .HasColumnName("id");

        builder.Property(x => x.WorkspaceId)
            .HasColumnName("workspace_id")
            .IsRequired();

        builder.Property(x => x.CaptureId)
            .HasColumnName("capture_id")
            .IsRequired();

        builder.Property(x => x.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Quantity)
            .HasColumnName("quantity")
            .IsRequired();

        builder.Property(x => x.Confidence)
            .HasColumnName("confidence")
            .HasColumnType("numeric(5,4)");

        builder.Property(x => x.IsRemoved)
            .HasColumnName("is_removed")
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        builder.HasOne(x => x.Capture)
            .WithMany(c => c.Suggestions)
            .HasPrincipalKey(c => new { c.WorkspaceId, c.Id })
            .HasForeignKey(x => new { x.WorkspaceId, x.CaptureId })
            .OnDelete(DeleteBehavior.Cascade);
    }
}
