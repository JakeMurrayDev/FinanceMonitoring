using System.ComponentModel.DataAnnotations;
using FinanceMonitoring.Api.Common.Dates;
using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Monetary;
using FinanceMonitoring.Api.Features.Rates;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Dashboard;

/// <summary>GET /api/dashboard?month=2026-11&amp;currency=EUR</summary>
public static class GetDashboard
{
    public const int TrendMonths = 6;

    // ── Request ────────────────────────────────────────────────────────────
    /// <param name="Month">The month to summarise (yyyy-MM). Defaults to the current month.</param>
    /// <param name="Currency">Display currency (ISO 4217). Amounts are converted from USD at the latest ECB rate.</param>
    public sealed record Request(
        [FromQuery(Name = "month")][property: RegularExpression(Months.Pattern, ErrorMessage = "Use the format yyyy-MM.")] string? Month = null,
        [FromQuery(Name = "currency")][property: RegularExpression(DisplayRate.CodePattern, ErrorMessage = DisplayRate.CodeMessage)] string Currency = "USD");

    // ── Response ───────────────────────────────────────────────────────────
    /// <param name="Month">The month summarised (yyyy-MM).</param>
    /// <param name="Currency">Currency of every amount in this response.</param>
    /// <param name="Rate">The rate used, or null when no conversion was needed (USD).</param>
    /// <param name="Totals">This month's income, expenses and net.</param>
    /// <param name="Previous">The previous month's totals, for comparison.</param>
    /// <param name="SavingsRateBasisPoints">Net as a share of income in basis points (2345 = 23.45%); null with no income. Currency-independent.</param>
    /// <param name="ByCategory">This month's expenses per category, largest first.</param>
    /// <param name="Trend">Income, expenses and net for the six months ending this month, oldest first. Months with no activity are zero.</param>
    public sealed record Response(
        string Month,
        string Currency,
        RateInfo? Rate,
        MonthTotals Totals,
        MonthTotals Previous,
        int? SavingsRateBasisPoints,
        IReadOnlyList<CategorySpend> ByCategory,
        IReadOnlyList<TrendPoint> Trend);

    /// <param name="Income">Income, in minor units of the response currency.</param>
    /// <param name="Expenses">Expenses, in minor units of the response currency.</param>
    /// <param name="Net">Income minus expenses (converted from the exact USD net, not from the converted parts).</param>
    public sealed record MonthTotals(long Income, long Expenses, long Net);

    /// <param name="CategoryId">Category slug.</param>
    /// <param name="Name">Display name.</param>
    /// <param name="Amount">Expenses this month, in minor units of the response currency.</param>
    public sealed record CategorySpend(string CategoryId, string Name, long Amount);

    /// <param name="Month">yyyy-MM.</param>
    /// <param name="Income">Minor units.</param>
    /// <param name="Expenses">Minor units.</param>
    /// <param name="Net">Minor units.</param>
    public sealed record TrendPoint(string Month, long Income, long Expenses, long Net);

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapGet("/dashboard", HandleAsync)
                .WithName(nameof(GetDashboard))
                .WithTags("Dashboard")
                .WithSummary("Monthly totals, spending by category and a six-month trend, in any supported currency.")
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        internal static async Task<Results<Ok<Response>, ValidationProblem, ProblemHttpResult>> HandleAsync(
            [AsParameters] Request request,
            AppDbContext db,
            IExchangeRateService rates,
            TimeProvider clock,
            CancellationToken cancellationToken)
        {
            DateOnly month;
            if (request.Month is null) month = Months.CurrentMonth(clock);
            else if (Months.TryParse(request.Month, out var parsed)) month = parsed.Value;
            else return Months.Invalid();

            var lookup = await DisplayRate.ResolveAsync(request.Currency, rates, cancellationToken);
            if (lookup.Invalid is { } invalid) return invalid;
            if (lookup.Unavailable is { } unavailable) return unavailable;
            var rate = lookup.Rate;

            // ── Aggregate in USD, in SQL ──────────────────────────────────────
            var trendStart = month.AddMonths(-(TrendMonths - 1));
            var monthEnd = month.AddMonths(1).AddDays(-1);

            var monthly = await db.Transactions.AsNoTracking()
                .Where(t => t.Date >= trendStart && t.Date <= monthEnd)
                .GroupBy(t => new { t.Date.Year, t.Date.Month, t.Type })
                .Select(g => new { g.Key.Year, g.Key.Month, g.Key.Type, Total = g.Sum(t => t.Amount) })
                .ToListAsync(cancellationToken);

            var byCategoryUsd = await db.Transactions.AsNoTracking()
                .Where(t => t.Type == TransactionType.Expense && t.Date >= month && t.Date <= monthEnd)
                .GroupBy(t => new { t.CategoryId, t.Category.Name })
                .Select(g => new { g.Key.CategoryId, g.Key.Name, Total = g.Sum(t => t.Amount) })
                .OrderByDescending(x => x.Total)
                .ThenBy(x => x.Name)
                .ToListAsync(cancellationToken);

            MonthTotals UsdTotals(DateOnly m)
            {
                long Sum(TransactionType type) => monthly
                    .Where(x => x.Year == m.Year && x.Month == m.Month && x.Type == type)
                    .Sum(x => x.Total);
                var income = Sum(TransactionType.Income);
                var expenses = Sum(TransactionType.Expense);
                return new MonthTotals(income, expenses, income - expenses);
            }

            // ── Convert each figure once, from its exact USD value ───────────
            // So each displayed number is right to the cent; parts may differ
            // from a converted total by a few cents, as on any FX statement.
            var target = rate is null ? Currency.Usd : Currency.FromCode(rate.Quote);
            long Convert(long usd) => rate is null ? usd : new Money(usd, Currency.Usd).ConvertTo(target, rate.Rate).Amount;
            MonthTotals ConvertTotals(MonthTotals t) => new(Convert(t.Income), Convert(t.Expenses), Convert(t.Net));

            var current = UsdTotals(month);
            var trend = Enumerable.Range(0, TrendMonths)
                .Select(i => trendStart.AddMonths(i))
                .Select(m =>
                {
                    var totals = ConvertTotals(UsdTotals(m));
                    return new TrendPoint(Months.Format(m), totals.Income, totals.Expenses, totals.Net);
                })
                .ToList();

            return TypedResults.Ok(new Response(
                Months.Format(month),
                target.Code,
                rate is null ? null : RateInfo.From(rate),
                ConvertTotals(current),
                ConvertTotals(UsdTotals(month.AddMonths(-1))),
                current.Income == 0 ? null : (int)(current.Net * 10_000 / current.Income),
                byCategoryUsd.Select(x => new CategorySpend(x.CategoryId, x.Name, Convert(x.Total))).ToList(),
                trend));
        }
    }
}
