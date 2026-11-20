using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Categories;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace FinanceMonitoring.Api.Data.Configurations;

internal sealed class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).HasMaxLength(32);
        builder.Property(c => c.Name).HasMaxLength(64).IsRequired();

        // Stored as "Income"/"Expense" rather than 0/1, so the database is readable.
        builder.Property(c => c.Type).HasConversion<string>().HasMaxLength(16);

        // Reference data belongs in migrations (HasData), unlike demo transactions,
        // which are seeded at runtime in Phase 2.
        builder.HasData(
            Expense("groceries", "Groceries"),
            Expense("rent", "Rent"),
            Expense("utilities", "Utilities"),
            Expense("transport", "Transport"),
            Expense("dining", "Dining Out"),
            Expense("entertainment", "Entertainment"),
            Expense("health", "Health"),
            Expense("shopping", "Shopping"),
            Expense("subscriptions", "Subscriptions"),
            Expense("travel", "Travel"),
            Income("salary", "Salary"),
            Income("freelance", "Freelance"),
            Income("interest", "Interest & Dividends"),
            Income("other-income", "Other Income"));
    }

    private static Category Expense(string id, string name) =>
        new() { Id = id, Name = name, Type = TransactionType.Expense };

    private static Category Income(string id, string name) =>
        new() { Id = id, Name = name, Type = TransactionType.Income };
}
