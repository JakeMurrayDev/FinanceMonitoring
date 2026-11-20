using System.ComponentModel.DataAnnotations;
using FinanceMonitoring.Api.Common.Dates;
using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Budgets;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Budgets;

/// <summary>GET /api/budgets?month=2026-11</summary>
public static class GetBudgets
{
    // ── Request ────────────────────────────────────────────────────────────
    /// <param name="Month">The month to report on (yyyy-MM). Defaults to the current month.</param>
    public sealed record Request(
        [FromQuery(Name = "month")][property: RegularExpression(Months.Pattern, ErrorMessage = "Use the format yyyy-MM.")] string? Month = null);

    // ── Response ───────────────────────────────────────────────────────────
    /// <param name="Month">The month reported on (yyyy-MM).</param>
    /// <param name="Currency">ISO 4217 code of every amount.</param>
    /// <param name="Lines">One line per expense category, by name.</param>
    /// <param name="Totals">Month totals.</param>
    public sealed record Response(string Month, string Currency, IReadOnlyList<BudgetLine> Lines, BudgetTotals Totals);

    /// <param name="CategoryId">Expense category slug.</param>
    /// <param name="CategoryName">Display name.</param>
    /// <param name="Budget">Limit for this month in minor units, or null if none applies.</param>
    /// <param name="BudgetEffectiveFrom">The month (yyyy-MM) the applicable budget row started; null if there has never been one.</param>
    /// <param name="Spent">Expenses in this category this month, in minor units.</param>
    /// <param name="Remaining">Budget minus spent (negative when over), or null with no budget.</param>
    /// <param name="PercentUsed">Whole percent of the budget spent, rounded down; null with no budget.</param>
    /// <param name="Status">How spending compares with the budget.</param>
    /// <param name="Version">Version of the row that starts this month, if any. Send it when changing this month's budget; null means the budget is inherited.</param>
    public sealed record BudgetLine(
        string CategoryId,
        string CategoryName,
        long? Budget,
        string? BudgetEffectiveFrom,
        long Spent,
        long? Remaining,
        int? PercentUsed,
        BudgetStatus Status,
        long? Version);

    /// <param name="Budgeted">Sum of all budgets this month.</param>
    /// <param name="SpentInBudgeted">Spending in categories that have a budget.</param>
    /// <param name="Remaining">Budgeted minus spent in budgeted categories.</param>
    /// <param name="Unbudgeted">Spending in categories with no budget.</param>
    /// <param name="OverBudgetCount">Number of categories over budget.</param>
    public sealed record BudgetTotals(long Budgeted, long SpentInBudgeted, long Remaining, long Unbudgeted, int OverBudgetCount);

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapGet("/budgets", HandleAsync)
                .WithName(nameof(GetBudgets))
                .WithTags("Budgets")
                .WithSummary("Budgets, spending and status for every expense category in a month.")
                .ProducesValidationProblem();

        internal static async Task<Results<Ok<Response>, ValidationProblem>> HandleAsync(
            [AsParameters] Request request,
            AppDbContext db,
            TimeProvider clock,
            CancellationToken cancellationToken)
        {
            DateOnly month;
            if (request.Month is null)
            {
                month = Months.CurrentMonth(clock);
            }
            else if (Months.TryParse(request.Month, out var parsed))
            {
                month = parsed.Value;
            }
            else
            {
                return Months.Invalid();
            }

            var lines = await BudgetQueries.GetLinesAsync(db, month, cancellationToken);

            var budgeted = lines.Where(l => l.Budget is not null).ToList();
            var totals = new BudgetTotals(
                Budgeted: budgeted.Sum(l => l.Budget!.Value),
                SpentInBudgeted: budgeted.Sum(l => l.Spent),
                Remaining: budgeted.Sum(l => l.Remaining!.Value),
                Unbudgeted: lines.Where(l => l.Budget is null).Sum(l => l.Spent),
                OverBudgetCount: lines.Count(l => l.Status == BudgetStatus.OverBudget));

            return TypedResults.Ok(new Response(Months.Format(month), "USD", lines, totals));
        }
    }
}

/// <summary>The budget-vs-spending calculation, shared by the read and write endpoints.</summary>
internal static class BudgetQueries
{
    public static async Task<List<GetBudgets.BudgetLine>> GetLinesAsync(
        AppDbContext db, DateOnly month, CancellationToken cancellationToken, string? onlyCategoryId = null)
    {
        var monthEnd = month.AddMonths(1).AddDays(-1);

        var categories = await db.Categories.AsNoTracking()
            .Where(c => c.Type == TransactionType.Expense && (onlyCategoryId == null || c.Id == onlyCategoryId))
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name })
            .ToListAsync(cancellationToken);

        // Effective dating: for each category, the latest row starting on or before this month.
        var effective = await db.Budgets.AsNoTracking()
            .Where(b => b.EffectiveFrom <= month)
            .GroupBy(b => b.CategoryId)
            .Select(g => g.OrderByDescending(b => b.EffectiveFrom).First())
            .ToDictionaryAsync(b => b.CategoryId, cancellationToken);

        // One aggregate query: expense totals per category within the month (inclusive).
        var spent = await db.Transactions.AsNoTracking()
            .Where(t => t.Type == TransactionType.Expense && t.Date >= month && t.Date <= monthEnd)
            .GroupBy(t => t.CategoryId)
            .Select(g => new { CategoryId = g.Key, Total = g.Sum(t => t.Amount) })
            .ToDictionaryAsync(x => x.CategoryId, x => x.Total, cancellationToken);

        return categories.Select(category =>
        {
            effective.TryGetValue(category.Id, out var row);
            var budget = row?.Amount;
            var spentTotal = spent.GetValueOrDefault(category.Id);
            return new GetBudgets.BudgetLine(
                category.Id,
                category.Name,
                budget,
                row is null ? null : Months.Format(row.EffectiveFrom),
                spentTotal,
                budget - spentTotal,
                BudgetMath.PercentUsed(spentTotal, budget),
                BudgetMath.Status(spentTotal, budget),
                row?.EffectiveFrom == month ? row.Version : null);
        }).ToList();
    }
}
