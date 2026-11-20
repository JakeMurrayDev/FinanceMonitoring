using System.Globalization;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Budgets;
using FinanceMonitoring.Api.Domain.Transactions;

namespace FinanceMonitoring.Api.Tests.Features.Budgets;

internal static class BudgetTestData
{
    public static DateOnly Day(string date) => DateOnly.Parse(date, CultureInfo.InvariantCulture);

    public static Transaction Spend(string date, long amount, string category, TransactionType type = TransactionType.Expense) => new()
    {
        Date = Day(date),
        Description = $"{category} on {date}",
        Amount = amount,
        Currency = "USD",
        Type = type,
        CategoryId = category,
    };

    public static Budget Limit(string category, long? amount, string fromMonth) => new()
    {
        CategoryId = category,
        EffectiveFrom = Day(fromMonth + "-01"),
        Amount = amount,
        Currency = "USD",
    };
}
