using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Transactions;
using FinanceMonitoring.Api.Tests.Infrastructure;

namespace FinanceMonitoring.Api.Tests.Features.Transactions;

/// <summary>
/// One API instance with a small, hand-picked dataset, shared by every test in
/// <see cref="ListTransactionsTests"/>. Each row exists to exercise a filter.
/// </summary>
public sealed class ListTransactionsFixture : IAsyncLifetime
{
    public FinanceApiFactory Factory { get; } = new();

    public static readonly Transaction[] Rows =
    [
        Row("2026-01-05", "Whole Foods Market", 8_250, TransactionType.Expense, "groceries"),
        Row("2026-01-15", "Payroll — Northwind", 485_000, TransactionType.Income, "salary"),
        Row("2026-01-20", "Blue Bottle Coffee", 650, TransactionType.Expense, "dining"),
        Row("2026-02-01", "Rent — Maple Court", 165_000, TransactionType.Expense, "rent"),
        Row("2026-02-03", "Trader Joe's", 6_420, TransactionType.Expense, "groceries"),
        Row("2026-02-10", "Freelance — logo design", 75_000, TransactionType.Income, "freelance"),
        Row("2026-02-14", "Sushi Ran", 9_800, TransactionType.Expense, "dining"),
        // Contains LIKE wildcards (% and _) to prove search escapes them.
        Row("2026-03-01", "100% Organic Juice_Bar", 1_200, TransactionType.Expense, "dining"),
    ];

    public async ValueTask InitializeAsync() =>
        await Factory.SeedAsync(Rows, TestContext.Current.CancellationToken);

    public async ValueTask DisposeAsync() => await Factory.DisposeAsync();

    private static Transaction Row(string date, string description, long amount, TransactionType type, string category) =>
        new()
        {
            Date = DateOnly.Parse(date, System.Globalization.CultureInfo.InvariantCulture),
            Description = description,
            Amount = amount,
            Currency = "USD",
            Type = type,
            CategoryId = category,
        };
}
