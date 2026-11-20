using System.Net;
using System.Net.Http.Json;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Budgets;
using FinanceMonitoring.Api.Features.Budgets;
using FinanceMonitoring.Api.Tests.Infrastructure;
using static FinanceMonitoring.Api.Tests.Features.Budgets.BudgetTestData;

namespace FinanceMonitoring.Api.Tests.Features.Budgets;

/// <summary>A known month of spending and budgets. "Now" is 2026-11-20 (FinanceApiFactory.Clock).</summary>
public sealed class GetBudgetsFixture : IAsyncLifetime
{
    public FinanceApiFactory Factory { get; } = new();

    public async ValueTask InitializeAsync() => await Factory.SeedAsync(
    [
        // Groceries: the month's first and last days count; neighbouring days don't.
        Spend("2026-10-31", 99_900, "groceries"),
        Spend("2026-11-01", 10_000, "groceries"),
        Spend("2026-11-30", 20_000, "groceries"),
        Spend("2026-12-01", 99_900, "groceries"),
        Limit("groceries", 40_000, "2026-09"),

        // Dining: $100 from September, raised to $150 from November.
        Spend("2026-10-05", 5_000, "dining"),
        Spend("2026-11-10", 12_000, "dining"),
        Limit("dining", 10_000, "2026-09"),
        Limit("dining", 15_000, "2026-11"),

        // Transport: one cent over. Budget only starts in October.
        Spend("2026-11-03", 5_001, "transport"),
        Limit("transport", 5_000, "2026-10"),

        // Rent: exactly at the limit.
        Spend("2026-11-01", 165_000, "rent"),
        Limit("rent", 165_000, "2026-11"),

        // Shopping: budget cleared from November, so this is unbudgeted spending.
        Spend("2026-11-12", 3_000, "shopping"),
        Limit("shopping", 10_000, "2026-09"),
        Limit("shopping", null, "2026-11"),

        // Income never counts as spending.
        Spend("2026-11-01", 485_000, "salary", TransactionType.Income),
    ], TestContext.Current.CancellationToken);

    public async ValueTask DisposeAsync() => await Factory.DisposeAsync();
}

public sealed class GetBudgetsTests(GetBudgetsFixture fixture) : IClassFixture<GetBudgetsFixture>
{
    private readonly HttpClient _client = fixture.Factory.CreateClient();

    [Fact]
    public async Task Reports_every_expense_category_with_spending_and_status()
    {
        var november = await GetAsync("?month=2026-11");

        november.Month.Should().Be("2026-11");
        november.Lines.Select(l => l.CategoryName).Should().BeInAscendingOrder(StringComparer.Ordinal)
            .And.HaveCount(10, "one line per expense category")
            .And.NotContain("Salary", "income categories don't have budgets");

        Line(november, "groceries").Should().BeEquivalentTo(new
        {
            Budget = 40_000L,
            BudgetEffectiveFrom = "2026-09",
            Spent = 30_000L,
            Remaining = 10_000L,
            PercentUsed = 75,
            Status = BudgetStatus.OnTrack,
            Version = (long?)null,
        });
        Line(november, "dining").Should().BeEquivalentTo(new
        {
            Budget = 15_000L,
            BudgetEffectiveFrom = "2026-11",
            Spent = 12_000L,
            PercentUsed = 80,
            Status = BudgetStatus.NearLimit,
            Version = 1L,
        });
        Line(november, "transport").Should().BeEquivalentTo(new
        {
            Budget = 5_000L,
            Spent = 5_001L,
            Remaining = -1L,
            Status = BudgetStatus.OverBudget,
        });
        Line(november, "rent").Status.Should().Be(BudgetStatus.NearLimit, "exactly 100% is not over");
        Line(november, "health").Should().BeEquivalentTo(new
        {
            Budget = (long?)null,
            BudgetEffectiveFrom = (string?)null,
            Spent = 0L,
            Status = BudgetStatus.NoBudget,
        });
    }

    [Fact]
    public async Task Counts_spending_on_the_first_and_last_day_of_the_month_only()
    {
        var november = await GetAsync("?month=2026-11");

        Line(november, "groceries").Spent.Should().Be(30_000, "Oct 31 and Dec 1 are excluded");
    }

    [Fact]
    public async Task Applies_the_budget_that_was_in_effect_that_month()
    {
        var september = await GetAsync("?month=2026-09");
        var october = await GetAsync("?month=2026-10");
        var november = await GetAsync("?month=2026-11");

        Line(october, "dining").Budget.Should().Be(10_000, "the November raise doesn't rewrite October");
        Line(november, "dining").Budget.Should().Be(15_000);
        Line(october, "groceries").Status.Should().Be(BudgetStatus.OverBudget, "October is judged on October's spending");
        Line(september, "transport").Status.Should().Be(BudgetStatus.NoBudget, "its budget only starts in October");
    }

    [Fact]
    public async Task Treats_a_cleared_budget_as_no_budget_from_that_month_on()
    {
        var october = await GetAsync("?month=2026-10");
        var november = await GetAsync("?month=2026-11");

        Line(october, "shopping").Budget.Should().Be(10_000);
        Line(november, "shopping").Should().BeEquivalentTo(new
        {
            Budget = (long?)null,
            BudgetEffectiveFrom = "2026-11",
            Spent = 3_000L,
            Status = BudgetStatus.NoBudget,
            Version = 1L,
        });
    }

    [Fact]
    public async Task Totals_the_month()
    {
        var november = await GetAsync("?month=2026-11");

        november.Totals.Should().Be(new GetBudgets.BudgetTotals(
            Budgeted: 40_000 + 15_000 + 5_000 + 165_000,
            SpentInBudgeted: 30_000 + 12_000 + 5_001 + 165_000,
            Remaining: 12_999,
            Unbudgeted: 3_000,
            OverBudgetCount: 1));
    }

    [Fact]
    public async Task Defaults_to_the_current_month()
    {
        (await GetAsync("")).Month.Should().Be("2026-11");
    }

    [Theory]
    [InlineData("2026-13")]
    [InlineData("2026-1")]
    [InlineData("0000-01")]
    [InlineData("november")]
    public async Task Rejects_an_invalid_month(string month)
    {
        var ct = TestContext.Current.CancellationToken;

        using var response = await _client.GetAsync(new Uri($"/api/budgets?month={month}", UriKind.Relative), ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private static GetBudgets.BudgetLine Line(GetBudgets.Response response, string categoryId) =>
        response.Lines.Single(l => l.CategoryId == categoryId);

    private async Task<GetBudgets.Response> GetAsync(string query) =>
        (await _client.GetFromJsonAsync<GetBudgets.Response>(
            new Uri($"/api/budgets{query}", UriKind.Relative), TestJson.Options, TestContext.Current.CancellationToken))!;
}
