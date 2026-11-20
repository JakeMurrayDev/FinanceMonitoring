using System.Net;
using System.Net.Http.Json;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Features.Dashboard;
using FinanceMonitoring.Api.Features.Rates;
using FinanceMonitoring.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using NSubstitute.ExceptionExtensions;
using static FinanceMonitoring.Api.Features.Dashboard.GetDashboard;
using static FinanceMonitoring.Api.Tests.Features.Budgets.BudgetTestData;

namespace FinanceMonitoring.Api.Tests.Features.Dashboard;

public sealed class GetDashboardFixture : IAsyncLifetime
{
    public FinanceApiFactory Factory { get; } = new();

    public async ValueTask InitializeAsync() => await Factory.SeedAsync(
    [
        // November 2026 (the month under test)
        Spend("2026-11-01", 30_000, "salary", TransactionType.Income),
        Spend("2026-11-01", 10_000, "rent"),
        Spend("2026-11-15", 1_001, "groceries"),
        Spend("2026-11-20", 1_001, "transport"),
        Spend("2026-11-30", 1_001, "dining"),
        // October: the "previous" month
        Spend("2026-10-01", 20_000, "salary", TransactionType.Income),
        Spend("2026-10-12", 5_000, "groceries"),
        // Earlier in the 6-month window; July and September stay empty
        Spend("2026-08-09", 1_000, "dining"),
        Spend("2026-06-30", 1_000, "freelance", TransactionType.Income),
        // Outside the window: must be ignored
        Spend("2026-05-31", 99_999, "freelance", TransactionType.Income),
        Spend("2026-12-01", 99_999, "rent"),
    ], TestContext.Current.CancellationToken);

    public async ValueTask DisposeAsync() => await Factory.DisposeAsync();
}

public sealed class GetDashboardTests : IClassFixture<GetDashboardFixture>
{
    private static readonly DateOnly EcbDate = new(2026, 11, 19);
    private readonly HttpClient _client;
    private readonly IExchangeRateService _rates;

    public GetDashboardTests(GetDashboardFixture fixture)
    {
        _client = fixture.Factory.CreateClient();
        _rates = fixture.Factory.Rates;
        _rates.ClearReceivedCalls();
        _rates.GetCurrenciesAsync(Arg.Any<CancellationToken>())
            .Returns(new Dictionary<string, string> { ["EUR"] = "Euro", ["JPY"] = "Japanese Yen" });
        _rates.GetUsdRateAsync("EUR", Arg.Any<CancellationToken>())
            .Returns(new ExchangeRate("USD", "EUR", 0.92345m, EcbDate, Stale: false));
    }

    [Fact]
    public async Task Summarises_a_month_in_usd_without_touching_exchange_rates()
    {
        var dashboard = await GetAsync("?month=2026-11");

        dashboard.Currency.Should().Be("USD");
        dashboard.Rate.Should().BeNull();
        dashboard.Totals.Should().Be(new MonthTotals(Income: 30_000, Expenses: 13_003, Net: 16_997));
        dashboard.Previous.Should().Be(new MonthTotals(Income: 20_000, Expenses: 5_000, Net: 15_000));
        dashboard.SavingsRateBasisPoints.Should().Be(5_665, "16,997 / 30,000 = 56.65%, rounded down");
        await _rates.DidNotReceive().GetUsdRateAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        await _rates.DidNotReceive().GetCurrenciesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Lists_expenses_by_category_largest_first()
    {
        var dashboard = await GetAsync("?month=2026-11");

        dashboard.ByCategory.Should().Equal(
            new CategorySpend("rent", "Rent", 10_000),
            new CategorySpend("dining", "Dining Out", 1_001),
            new CategorySpend("groceries", "Groceries", 1_001),
            new CategorySpend("transport", "Transport", 1_001));
    }

    [Fact]
    public async Task Shows_six_months_of_trend_with_empty_months_as_zero()
    {
        var dashboard = await GetAsync("?month=2026-11");

        dashboard.Trend.Should().Equal(
            new TrendPoint("2026-06", 1_000, 0, 1_000),
            new TrendPoint("2026-07", 0, 0, 0),
            new TrendPoint("2026-08", 0, 1_000, -1_000),
            new TrendPoint("2026-09", 0, 0, 0),
            new TrendPoint("2026-10", 20_000, 5_000, 15_000),
            new TrendPoint("2026-11", 30_000, 13_003, 16_997));
    }

    [Fact]
    public async Task Converts_every_figure_once_from_usd_rounding_half_to_even()
    {
        var dashboard = await GetAsync("?month=2026-11&currency=EUR");

        dashboard.Currency.Should().Be("EUR");
        dashboard.Rate.Should().Be(new RateInfo("USD", "EUR", "0.92345", "2026-11-19", Stale: false));
        // 27,703.5 → 27,704 (tie to even) · 12,007.62 → 12,008 · 15,695.88 → 15,696
        dashboard.Totals.Should().Be(new MonthTotals(27_704, 12_008, 15_696));
        dashboard.Previous.Should().Be(new MonthTotals(18_469, 4_617, 13_852));
        dashboard.ByCategory[0].Amount.Should().Be(9_234, "9,234.5 is a tie, and 9,234 is even");
        dashboard.SavingsRateBasisPoints.Should().Be(5_665, "a ratio doesn't change with currency");
    }

    [Fact]
    public async Task Converts_parts_independently_so_they_can_differ_from_the_total_by_cents()
    {
        var dashboard = await GetAsync("?month=2026-11&currency=EUR");

        // Each 10.01 USD → 9.2437… EUR → 9.24. Rent 9,234 + 3 × 924 = 12,006,
        // while total expenses (130.03 USD) convert to 12,008. This is intended:
        // every number shown is the correct conversion of its exact USD value.
        dashboard.ByCategory.Sum(c => c.Amount).Should().Be(12_006);
        dashboard.Totals.Expenses.Should().Be(12_008);
    }

    [Fact]
    public async Task Passes_on_a_stale_rate_so_the_ui_can_warn()
    {
        _rates.GetUsdRateAsync("EUR", Arg.Any<CancellationToken>())
            .Returns(new ExchangeRate("USD", "EUR", 0.92345m, EcbDate, Stale: true));

        var dashboard = await GetAsync("?month=2026-11&currency=EUR");

        dashboard.Rate!.Stale.Should().BeTrue();
    }

    [Fact]
    public async Task Returns_503_when_no_rate_is_available()
    {
        var ct = TestContext.Current.CancellationToken;
        _rates.GetUsdRateAsync("JPY", Arg.Any<CancellationToken>())
            .ThrowsAsync(new RatesUnavailableException("The USD/JPY rate is unavailable right now."));

        using var response = await _client.GetAsync(new Uri("/api/dashboard?currency=JPY", UriKind.Relative), ct);

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(TestJson.Options, ct);
        problem!.Title.Should().Be("Exchange rates are unavailable right now.");
    }

    [Theory]
    [InlineData("?currency=GBP", "currency")] // well-formed but not in the supported list
    [InlineData("?currency=eur", "currency")]
    [InlineData("?month=2026-13", "month")]
    public async Task Rejects_invalid_input(string query, string field)
    {
        var ct = TestContext.Current.CancellationToken;

        using var response = await _client.GetAsync(new Uri($"/api/dashboard{query}", UriKind.Relative), ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(TestJson.Options, ct);
        problem!.Errors.Should().ContainKey(field);
    }

    [Fact]
    public async Task Defaults_to_the_current_month_in_usd()
    {
        var dashboard = await GetAsync("");

        dashboard.Month.Should().Be("2026-11");
        dashboard.Currency.Should().Be("USD");
    }

    private async Task<Response> GetAsync(string query) =>
        (await _client.GetFromJsonAsync<Response>(
            new Uri($"/api/dashboard{query}", UriKind.Relative), TestJson.Options, TestContext.Current.CancellationToken))!;
}
