using FinanceMonitoring.Api.Domain.Budgets;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceMonitoring.Api.Data.Configurations;

internal sealed class BudgetConfiguration : IEntityTypeConfiguration<Budget>
{
    public void Configure(EntityTypeBuilder<Budget> builder)
    {
        builder.ToTable(table =>
        {
            table.HasCheckConstraint("CK_Budgets_Amount_PositiveOrCleared", "\"Amount\" IS NULL OR \"Amount\" > 0");
            // DateOnly is stored as 'yyyy-MM-dd' text in SQLite.
            table.HasCheckConstraint("CK_Budgets_EffectiveFrom_FirstOfMonth", "substr(\"EffectiveFrom\", 9, 2) = '01'");
        });

        builder.HasKey(b => b.Id);
        builder.Property(b => b.Currency).HasMaxLength(3).IsFixedLength().IsRequired();
        builder.Property(b => b.Version).IsConcurrencyToken();

        builder.HasOne(b => b.Category)
            .WithMany()
            .HasForeignKey(b => b.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // At most one change per category per month; also the lookup index for
        // "latest row on or before month X".
        builder.HasIndex(b => new { b.CategoryId, b.EffectiveFrom }).IsUnique();
    }
}
