using FinanceMonitoring.Api.Domain.Transactions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceMonitoring.Api.Data.Configurations;

internal sealed class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        // Last line of defence: even a bug that skips validation can't store
        // a zero/negative amount or a malformed currency.
        builder.ToTable(table =>
        {
            table.HasCheckConstraint("CK_Transactions_Amount_Positive", "\"Amount\" > 0");
            table.HasCheckConstraint("CK_Transactions_Currency_Length", "length(\"Currency\") = 3");
        });

        builder.HasKey(t => t.Id);
        builder.Property(t => t.Description).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Currency).HasMaxLength(3).IsFixedLength().IsRequired();
        builder.Property(t => t.Type).HasConversion<string>().HasMaxLength(16);
        builder.Property(t => t.Version).IsConcurrencyToken().HasDefaultValue(1L);

        builder.HasOne(t => t.Category)
            .WithMany()
            .HasForeignKey(t => t.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        // The columns the transactions list filters and sorts on.
        builder.HasIndex(t => t.Date);
        builder.HasIndex(t => new { t.Type, t.Date });
        builder.HasIndex(t => new { t.CategoryId, t.Date });
    }
}
