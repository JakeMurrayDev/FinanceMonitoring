using System.ComponentModel.DataAnnotations;
using FinanceMonitoring.Api.Common.Dates;
using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Data;
using Microsoft.AspNetCore.Mvc;

namespace FinanceMonitoring.Api.Features.Budgets;

/// <summary>DELETE /api/budgets/{categoryId}?month=2026-11&amp;version=2: stop budgeting from a month onward.</summary>
public static class ClearBudget
{
    // ── Request ────────────────────────────────────────────────────────────
    /// <param name="CategoryId">Expense category slug.</param>
    /// <param name="Month">First month without a budget (yyyy-MM). Earlier months keep theirs.</param>
    /// <param name="Version">The line's <c>version</c> if a row starts this month; omit if inherited.</param>
    public sealed record Request(
        string CategoryId,
        [FromQuery(Name = "month")][property: Required(ErrorMessage = "Choose a month."), RegularExpression(Months.Pattern, ErrorMessage = "Use the format yyyy-MM.")] string Month,
        [FromQuery(Name = "version")] long? Version = null);

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapDelete("/budgets/{categoryId}", HandleAsync)
                .WithName(nameof(ClearBudget))
                .WithTags("Budgets")
                .WithSummary("Clear a category's budget from a month onward. Returns the updated line.")
                .Produces<GetBudgets.BudgetLine>()
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict);

        internal static async Task<IResult> HandleAsync(
            [AsParameters] Request request,
            AppDbContext db,
            TimeProvider clock,
            CancellationToken cancellationToken)
        {
            if (await BudgetRules.ValidateCategoryAsync(db, request.CategoryId, cancellationToken) is { } invalid)
            {
                return invalid;
            }

            if (!Months.TryParse(request.Month, out var parsed))
            {
                return Months.Invalid();
            }

            var month = parsed.Value;
            var current = (await BudgetQueries.GetLinesAsync(db, month, cancellationToken, request.CategoryId)).Single();

            // Nothing applies this month and no row starts here: already clear.
            if (current.Budget is null && current.Version is null)
            {
                return TypedResults.Ok(current);
            }

            var outcome = await BudgetWrites.UpsertAsync(
                db, clock, request.CategoryId, month, amount: null, request.Version, cancellationToken);
            if (outcome is not null)
            {
                return outcome;
            }

            var line = (await BudgetQueries.GetLinesAsync(db, month, cancellationToken, request.CategoryId)).Single();
            return TypedResults.Ok(line);
        }
    }
}
