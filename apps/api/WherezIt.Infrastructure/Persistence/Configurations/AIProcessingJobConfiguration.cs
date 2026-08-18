using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class AIProcessingJobConfiguration : IEntityTypeConfiguration<AIProcessingJob>
{
    public void Configure(EntityTypeBuilder<AIProcessingJob> builder)
    {
        builder.ToTable("ai_processing_jobs", t =>
        {
            t.HasCheckConstraint("CK_ai_processing_jobs_status_valid", "status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')");
            t.HasCheckConstraint("CK_ai_processing_jobs_attempt_nonnegative", "attempt_count >= 0");
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

        builder.Property(x => x.Status)
            .HasColumnName("status")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(x => x.AttemptCount)
            .HasColumnName("attempt_count")
            .IsRequired();

        builder.Property(x => x.LastError)
            .HasColumnName("last_error");

        builder.Property(x => x.InputMetadata)
            .HasColumnName("input_metadata")
            .HasColumnType("jsonb");

        builder.Property(x => x.OutputMetadata)
            .HasColumnName("output_metadata")
            .HasColumnType("jsonb");

        builder.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(x => x.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        builder.HasOne(x => x.Capture)
            .WithMany(c => c.Jobs)
            .HasPrincipalKey(c => new { c.WorkspaceId, c.Id })
            .HasForeignKey(x => new { x.WorkspaceId, x.CaptureId })
            .OnDelete(DeleteBehavior.Cascade);
    }
}
