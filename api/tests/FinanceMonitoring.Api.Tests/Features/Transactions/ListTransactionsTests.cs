using System.Net;
using System.Net.Http.Json;
using FinanceMonitoring.Api.Common.Paging;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using static FinanceMonitoring.Api.Features.Transactions.ListTransactions;

namespace FinanceMonitoring.Api.Tests.Features.Transactions;

public sealed class ListTransactionsTests(ListTransactionsFixture fixture) : IClassFixture<ListTransactionsFixture>
{
    private readonly HttpClient _client = fixture.Factory.CreateClient();

    // ── Defaults ───────────────────────────────────────────────────────────

    [Fact]
    public async Task Returns_everything_newest_first_by_default()
    {
        var page = await GetAsync("");

        page.TotalCount.Should().Be(8);
        page.Page.Should().Be(1);
        page.PageSize.Should().Be(25);
        page.Items.Select(i => i.Date).Should().BeInDescendingOrder();
        page.Items[0].Description.Should().Be("100% Organic Juice_Bar");
    }

    [Fact]
    public async Task Includes_the_category_name_so_the_client_needs_no_second_request()
    {
        var page = await GetAsync("?search=Sushi");

        page.Items.Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Description = "Sushi Ran",
            Amount = 9_800L,
            Currency = "USD",
            Type = TransactionType.Expense,
            CategoryId = "dining",
            CategoryName = "Dining Out",
        });
    }

    // ── Filters ────────────────────────────────────────────────────────────

    [Theory]
    [InlineData("coffee", "Blue Bottle Coffee")] // case-insensitive
    [InlineData("100%", "100% Organic Juice_Bar")] // % is literal, not a wildcard
    [InlineData("_", "100% Organic Juice_Bar")] // _ is literal, not a wildcard
    public async Task Searches_descriptions(string search, string expected)
    {
        var page = await GetAsync($"?search={Uri.EscapeDataString(search)}");

        page.Items.Should().ContainSingle().Which.Description.Should().Be(expected);
    }

    [Fact]
    public async Task Filters_by_type()
    {
        var page = await GetAsync("?type=Income");

        page.Items.Should().HaveCount(2).And.OnlyContain(i => i.Type == TransactionType.Income);
    }

    [Fact]
    public async Task Filters_by_any_of_several_categories()
    {
        var page = await GetAsync("?category=dining&category=groceries");

        page.TotalCount.Should().Be(5);
        page.Items.Select(i => i.CategoryId).Should().OnlyContain(id => id == "dining" || id == "groceries");
    }

    [Fact]
    public async Task Filters_by_an_inclusive_date_range()
    {
        var page = await GetAsync("?from=2026-02-01&to=2026-02-10");

        page.Items.Select(i => i.Description).Should().BeEquivalentTo(
            "Rent — Maple Court", "Trader Joe's", "Freelance — logo design");
    }

    [Fact]
    public async Task Combines_filters()
    {
        var page = await GetAsync("?type=Expense&from=2026-02-01&category=dining");

        page.Items.Select(i => i.Description).Should().BeEquivalentTo("Sushi Ran", "100% Organic Juice_Bar");
    }

    [Fact]
    public async Task Returns_an_empty_page_when_nothing_matches()
    {
        var page = await GetAsync("?search=nothing-matches-this");

        page.Items.Should().BeEmpty();
        page.TotalCount.Should().Be(0);
        page.TotalPages.Should().Be(0);
    }

    // ── Sorting ────────────────────────────────────────────────────────────

    [Fact]
    public async Task Sorts_by_signed_amount_so_expenses_come_before_income()
    {
        var ascending = await GetAsync("?sort=Amount&dir=Asc");
        var descending = await GetAsync("?sort=Amount&dir=Desc");

        ascending.Items[0].Description.Should().Be("Rent — Maple Court"); // −1,650.00
        ascending.Items[^1].Description.Should().Be("Payroll — Northwind"); // +4,850.00
        descending.Items.Select(i => i.Id).Should().Equal(ascending.Items.Select(i => i.Id).Reverse());
    }

    [Fact]
    public async Task Sorts_by_description_and_by_category_name()
    {
        var byDescription = await GetAsync("?sort=Description&dir=Asc");
        var byCategory = await GetAsync("?sort=Category&dir=Asc");

        byDescription.Items.Select(i => i.Description).Should().BeInAscendingOrder(StringComparer.Ordinal);
        byCategory.Items.Select(i => i.CategoryName).Should().BeInAscendingOrder(StringComparer.Ordinal);
    }

    // ── Paging ─────────────────────────────────────────────────────────────

    [Fact]
    public async Task Pages_through_results()
    {
        var last = await GetAsync("?pageSize=3&page=3");
        var beyond = await GetAsync("?pageSize=3&page=4");

        last.Items.Should().HaveCount(2);
        last.TotalPages.Should().Be(3);
        beyond.Items.Should().BeEmpty();
        beyond.TotalCount.Should().Be(8, "the total still describes the whole result set");
    }

    [Fact]
    public async Task Pages_stably_even_when_many_rows_share_a_sort_value()
    {
        // Three rows share the "Dining Out" category name; without a unique
        // tiebreaker they could shuffle between page requests.
        var ids = new List<Guid>();
        for (var page = 1; page <= 3; page++)
        {
            ids.AddRange((await GetAsync($"?sort=Category&pageSize=3&page={page}")).Items.Select(i => i.Id));
        }

        ids.Should().OnlyHaveUniqueItems().And.HaveCount(8);
    }

    // ── Validation ─────────────────────────────────────────────────────────

    [Theory]
    [InlineData("?pageSize=0", "PageSize")]
    [InlineData("?pageSize=101", "PageSize")]
    [InlineData("?page=0", "Page")]
    [InlineData("?from=2026-03-01&to=2026-02-01", "From")]
    public async Task Rejects_invalid_queries_with_validation_problem_details(string query, string field)
    {
        var ct = TestContext.Current.CancellationToken;

        using var response = await _client.GetAsync(new Uri($"/api/transactions{query}", UriKind.Relative), ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(TestJson.Options, ct);
        problem!.Errors.Should().ContainKey(field);
    }

    [Theory]
    [InlineData("?sort=Bogus")]
    [InlineData("?type=income")] // enum values are case-sensitive
    [InlineData("?from=not-a-date")]
    public async Task Rejects_unparseable_values(string query)
    {
        var ct = TestContext.Current.CancellationToken;

        using var response = await _client.GetAsync(new Uri($"/api/transactions{query}", UriKind.Relative), ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private async Task<PagedResponse<TransactionItem>> GetAsync(string query)
    {
        var page = await _client.GetFromJsonAsync<PagedResponse<TransactionItem>>(
            new Uri($"/api/transactions{query}", UriKind.Relative),
            TestJson.Options,
            TestContext.Current.CancellationToken);
        return page!;
    }
}
