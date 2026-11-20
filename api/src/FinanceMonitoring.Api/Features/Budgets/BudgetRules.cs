using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Domain;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Budgets;

internal static class BudgetRules
{
    /// <summary>
    /// Budgets apply to expense categories only. Returns an error result, or
    /// null when the category is valid.
    /// </summary>
    public static async Task<IResult?> ValidateCategoryAsync(
        AppDbContext db, string categoryId, CancellationToken cancellationToken)
    {
        var category = await db.Categories.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == categoryId, cancellationToken);

        if (category is null)
        {
            return TypedResults.NotFound();
        }

        return category.Type == TransactionType.Expense
            ? null
            : TypedResults.ValidationProblem(new Dictionary<string, string[]>
            {
                ["categoryId"] = [$"{category.Name} is an income category; budgets are for expenses."],
            });
    }
}
