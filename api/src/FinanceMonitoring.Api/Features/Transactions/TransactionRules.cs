using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Categories;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Transactions;

/// <summary>
/// Business rules shared by create and update that need the database or the
/// clock, so they can't be DataAnnotations. Errors use the same shape as
/// built-in validation, so clients handle both identically.
/// </summary>
internal static class TransactionRules
{
    /// <summary>
    /// Clients check "not in the future" against the user's local date. The
    /// server only knows UTC, and a user in UTC+14 is up to a day ahead of it.
    /// </summary>
    private const int TimeZoneSlackDays = 1;

    public static async Task<Dictionary<string, string[]>> ValidateAsync(
        DateOnly date,
        TransactionType type,
        string categoryId,
        AppDbContext db,
        TimeProvider clock,
        CancellationToken cancellationToken)
    {
        var errors = new Dictionary<string, string[]>();

        var latestAllowed = DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime).AddDays(TimeZoneSlackDays);
        if (date > latestAllowed)
        {
            errors["date"] = ["Date can’t be in the future."];
        }

        var category = await db.Categories.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == categoryId, cancellationToken);
        if (category is null)
        {
            errors["categoryId"] = [$"Unknown category \"{categoryId}\"."];
        }
        else if (category.Type != type)
        {
            errors["categoryId"] = [MismatchMessage(category)];
        }

        return errors;
    }

    private static string MismatchMessage(Category category) =>
        $"{category.Name} is an {category.Type.ToString().ToLowerInvariant()} category.";
}
