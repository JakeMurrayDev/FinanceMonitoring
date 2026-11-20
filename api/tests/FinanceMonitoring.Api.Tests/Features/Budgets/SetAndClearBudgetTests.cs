using System.Net;
using System.Net.Http.Json;
using FinanceMonitoring.Api.Domain.Budgets;
using FinanceMonitoring.Api.Features.Budgets;
using FinanceMonitoring.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;

namespace FinanceMonitoring.Api.Tests.Features.Budgets;

/// <summary>Each test uses its own category, so they can share one database.</summary>
public sealed class SetAndClearBudgetTests(FinanceApiFactory factory) : IClassFixture<FinanceApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    // ── Set ────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Sets_a_budget_from_a_month_onward_without_touching_earlier_months()
    {
        var line = await SetAsync("groceries", "2026-11", 50_000, version: null);

        line.Should().BeEquivalentTo(new { Budget = 50_000L, BudgetEffectiveFrom = "2026-11", Version = 1L });
        (await BudgetFor("groceries", "2026-10")).Should().BeNull();
        (await BudgetFor("groceries", "2027-03")).Should().Be(50_000, "it applies onward");
    }

    [Fact]
    public async Task Changing_an_inherited_budget_adds_a_new_row_and_keeps_history()
    {
        await SetAsync("dining", "2026-09", 30_000, version: null);

        var november = await SetAsync("dining", "2026-11", 45_000, version: null);

        november.BudgetEffectiveFrom.Should().Be("2026-11");
        (await BudgetFor("dining", "2026-10")).Should().Be(30_000);
        (await BudgetFor("dining", "2026-11")).Should().Be(45_000);
    }

    [Fact]
    public async Task Changing_this_months_row_requires_its_current_version()
    {
        var first = await SetAsync("transport", "2026-11", 10_000, version: null);

        var second = await SetAsync("transport", "2026-11", 12_000, version: first.Version);
        second.Version.Should().Be(2);

        using var stale = await PutAsync("transport", new SetBudget.Request("2026-11", 15_000, Version: 1));
        using var missing = await PutAsync("transport", new SetBudget.Request("2026-11", 15_000, Version: null));
        stale.StatusCode.Should().Be(HttpStatusCode.Conflict);
        missing.StatusCode.Should().Be(HttpStatusCode.Conflict, "a row exists, so the caller must quote its version");
        (await BudgetFor("transport", "2026-11")).Should().Be(12_000);
    }

    [Theory]
    [InlineData("entertainment", "2026-11", 0, "amount")]
    [InlineData("entertainment", "2026-13", 1_000, "month")]
    [InlineData("entertainment", "0000-01", 1_000, "month")]
    [InlineData("salary", "2026-11", 1_000, "categoryId")]
    public async Task Rejects_invalid_input(string category, string month, long amount, string field)
    {
        var ct = TestContext.Current.CancellationToken;

        using var response = await PutAsync(category, new SetBudget.Request(month, amount, null));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(TestJson.Options, ct);
        problem!.Errors.Should().ContainKey(field);
    }

    [Fact]
    public async Task Returns_404_for_an_unknown_category()
    {
        using var response = await PutAsync("lottery", new SetBudget.Request("2026-11", 1_000, null));

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    // ── Clear ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Clears_a_budget_from_a_month_onward_and_keeps_earlier_months()
    {
        await SetAsync("utilities", "2026-09", 20_000, version: null);

        var cleared = await DeleteAsync("utilities", "2026-11", version: null);

        cleared.Should().BeEquivalentTo(new { Budget = (long?)null, Status = BudgetStatus.NoBudget, BudgetEffectiveFrom = "2026-11" });
        (await BudgetFor("utilities", "2026-10")).Should().Be(20_000);
        (await BudgetFor("utilities", "2027-01")).Should().BeNull();
    }

    [Fact]
    public async Task Clearing_this_months_row_requires_its_current_version()
    {
        var ct = TestContext.Current.CancellationToken;
        await SetAsync("subscriptions", "2026-11", 3_000, version: null);

        using var stale = await _client.DeleteAsync(Url("subscriptions", "month=2026-11&version=7"), ct);

        stale.StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await BudgetFor("subscriptions", "2026-11")).Should().Be(3_000);
    }

    [Fact]
    public async Task Clearing_when_there_is_no_budget_changes_nothing()
    {
        var line = await DeleteAsync("travel", "2026-11", version: null);

        line.Should().BeEquivalentTo(new { Budget = (long?)null, BudgetEffectiveFrom = (string?)null, Version = (long?)null });
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private static Uri Url(string category, string query = "") =>
        new($"/api/budgets/{category}{(query.Length > 0 ? "?" + query : "")}", UriKind.Relative);

    private Task<HttpResponseMessage> PutAsync(string category, SetBudget.Request request) =>
        _client.PutAsJsonAsync(Url(category), request, TestJson.Options, TestContext.Current.CancellationToken);

    private async Task<GetBudgets.BudgetLine> SetAsync(string category, string month, long amount, long? version)
    {
        using var response = await PutAsync(category, new SetBudget.Request(month, amount, version));
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<GetBudgets.BudgetLine>(TestJson.Options, TestContext.Current.CancellationToken))!;
    }

    private async Task<GetBudgets.BudgetLine> DeleteAsync(string category, string month, long? version)
    {
        var ct = TestContext.Current.CancellationToken;
        var query = version is null ? $"month={month}" : $"month={month}&version={version}";
        using var response = await _client.DeleteAsync(Url(category, query), ct);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        return (await response.Content.ReadFromJsonAsync<GetBudgets.BudgetLine>(TestJson.Options, ct))!;
    }

    private async Task<long?> BudgetFor(string category, string month)
    {
        var response = await _client.GetFromJsonAsync<GetBudgets.Response>(
            new Uri($"/api/budgets?month={month}", UriKind.Relative), TestJson.Options, TestContext.Current.CancellationToken);
        return response!.Lines.Single(l => l.CategoryId == category).Budget;
    }
}
