using System.ComponentModel.DataAnnotations;
using FinanceMonitoring.Api.Common.Dates;
using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Common.Http;
using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Domain.Budgets;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Budgets;

/// <summary>PUT /api/budgets/{categoryId}: set a category's budget from a month onward.</summary>
public static class SetBudget
{
    // ── Request ────────────────────────────────────────────────────────────
    /// <param name="Month">First month the budget applies to (yyyy-MM). Earlier months are unaffected.</param>
    /// <param name="Amount">Monthly limit in minor units (cents), greater than zero.</param>
    /// <param name="Version">The line's <c>version</c> if a row already starts this month; null if the budget is inherited or new.</param>
    public sealed record Request(
        [property: Required(ErrorMessage = "Choose a month."), RegularExpression(Months.Pattern, ErrorMessage = "Use the format yyyy-MM.")] string Month,
        [property: Range(typeof(long), "1", "9007199254740991", ErrorMessage = "Enter a budget greater than zero.")] long Amount,
        long? Version);

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapPut("/budgets/{categoryId}", HandleAsync)
                .WithName(nameof(SetBudget))
                .WithTags("Budgets")
                .WithSummary("Set a category's monthly budget from a month onward.")
                .Produces<GetBudgets.BudgetLine>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict);

        internal static async Task<IResult> HandleAsync(
            string categoryId,
            Request request,
            AppDbContext db,
            TimeProvider clock,
            CancellationToken cancellationToken)
        {
            if (await BudgetRules.ValidateCategoryAsync(db, categoryId, cancellationToken) is { } invalid)
            {
                return invalid;
            }

            if (!Months.TryParse(request.Month, out var parsed))
            {
                return Months.Invalid();
            }

            var month = parsed.Value;
            var outcome = await BudgetWrites.UpsertAsync(db, clock, categoryId, month, request.Amount, request.Version, cancellationToken);
            if (outcome is not null)
            {
                return outcome;
            }

            var line = (await BudgetQueries.GetLinesAsync(db, month, cancellationToken, categoryId)).Single();
            return TypedResults.Ok(line);
        }
    }
}

internal static class BudgetWrites
{
    /// <summary>
    /// Create or update the row starting <paramref name="month"/>. A null
    /// <paramref name="amount"/> clears the budget from that month on.
    /// Returns a 409 result on a version mismatch, otherwise null.
    /// </summary>
    public static async Task<IResult?> UpsertAsync(
        AppDbContext db,
        TimeProvider clock,
        string categoryId,
        DateOnly month,
        long? amount,
        long? expectedVersion,
        CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();
        var row = await db.Budgets.FirstOrDefaultAsync(
            b => b.CategoryId == categoryId && b.EffectiveFrom == month, cancellationToken);

        if (row is not null)
        {
            if (row.Version != expectedVersion)
            {
                return ConflictProblem.For("budget", row.Version);
            }

            row.Amount = amount;
            row.UpdatedAt = now;
            row.Version++;
        }
        else
        {
            if (expectedVersion is not null)
            {
                // The client expected a row for this month that no longer exists.
                return ConflictProblem.For("budget", currentVersion: null);
            }

            db.Budgets.Add(new Budget
            {
                CategoryId = categoryId,
                EffectiveFrom = month,
                Amount = amount,
                Currency = "USD",
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return null;
        }
        catch (DbUpdateConcurrencyException)
        {
            return ConflictProblem.For("budget", currentVersion: null);
        }
        catch (DbUpdateException)
        {
            // Unique (CategoryId, EffectiveFrom): someone else created this month's row first.
            return ConflictProblem.For("budget", currentVersion: null);
        }
    }
}
