using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class InventoryNamespaceBoxCounterConfiguration : IEntityTypeConfiguration<InventoryNamespaceBoxCounter>
{
    public void Configure(EntityTypeBuilder<InventoryNamespaceBoxCounter> builder)
    {
        builder.ToTable("inventory_namespace_box_counters");

        builder.HasKey(x => x.InventoryNamespaceId);

        builder.Property(x => x.InventoryNamespaceId)
            .HasColumnName("inventory_namespace_id");

        builder.Property(x => x.NextBoxNumber)
            .HasColumnName("next_box_number")
            .HasDefaultValue(1)
            .IsRequired();

        builder.HasOne(x => x.InventoryNamespace)
            .WithOne(n => n.BoxCounter)
            .HasForeignKey<InventoryNamespaceBoxCounter>(x => x.InventoryNamespaceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
