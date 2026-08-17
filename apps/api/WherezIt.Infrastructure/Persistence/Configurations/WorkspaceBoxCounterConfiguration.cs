using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class WorkspaceBoxCounterConfiguration : IEntityTypeConfiguration<WorkspaceBoxCounter>
{
    public void Configure(EntityTypeBuilder<WorkspaceBoxCounter> builder)
    {
        builder.ToTable("workspace_box_counters");

        builder.HasKey(c => c.WorkspaceId);

        builder.Property(c => c.WorkspaceId)
            .HasColumnName("workspace_id");

        builder.Property(c => c.NextBoxNumber)
            .HasColumnName("next_box_number")
            .HasDefaultValue(1)
            .IsRequired();

        builder.HasOne(c => c.Workspace)
            .WithOne()
            .HasForeignKey<WorkspaceBoxCounter>(c => c.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
