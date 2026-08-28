using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WherezIt.Domain.Entities;

namespace WherezIt.Infrastructure.Persistence.Configurations;

public class InventoryNamespaceMemberConfiguration : IEntityTypeConfiguration<InventoryNamespaceMember>
{
    public void Configure(EntityTypeBuilder<InventoryNamespaceMember> builder)
    {
        builder.ToTable("inventory_namespace_members");

        builder.HasKey(x => new { x.InventoryNamespaceId, x.UserId });

        builder.Property(x => x.InventoryNamespaceId)
            .HasColumnName("inventory_namespace_id");

        builder.Property(x => x.UserId)
            .HasColumnName("user_id");

        builder.Property(x => x.Role)
            .HasColumnName("role")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.CreatedAt)
            .HasColumnName("created_at")
            .HasColumnType("timestamp with time zone")
            .IsRequired();

        builder.HasOne(x => x.InventoryNamespace)
            .WithMany(n => n.Members)
            .HasForeignKey(x => x.InventoryNamespaceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.User)
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
