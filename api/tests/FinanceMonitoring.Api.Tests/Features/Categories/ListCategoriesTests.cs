using System.Net;
using System.Net.Http.Json;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Features.Categories;
using FinanceMonitoring.Api.Tests.Infrastructure;

namespace FinanceMonitoring.Api.Tests.Features.Categories;

public sealed class ListCategoriesTests(FinanceApiFactory factory) : IClassFixture<FinanceApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Returns_every_seeded_category_sorted_by_name()
    {
        var response = await GetAsync("/api/categories");

        response.Categories.Should().HaveCount(14);
        response.Categories.Should().BeInAscendingOrder(c => c.Name, StringComparer.Ordinal);
        response.Categories.Should().ContainEquivalentOf(
            new ListCategories.CategoryItem("groceries", "Groceries", TransactionType.Expense));
    }

    [Theory]
    [InlineData(TransactionType.Income, 4)]
    [InlineData(TransactionType.Expense, 10)]
    public async Task Filters_by_type(TransactionType type, int expectedCount)
    {
        var response = await GetAsync($"/api/categories?type={type}");

        response.Categories.Should().HaveCount(expectedCount)
            .And.OnlyContain(c => c.Type == type);
    }

    [Fact]
    public async Task Rejects_an_unknown_type_with_a_problem_details_400()
    {
        var ct = TestContext.Current.CancellationToken;

        using var response = await _client.GetAsync(new Uri("/api/categories?type=Bogus", UriKind.Relative), ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
    }

    private async Task<ListCategories.Response> GetAsync(string url)
    {
        var ct = TestContext.Current.CancellationToken;
        var response = await _client.GetFromJsonAsync<ListCategories.Response>(
            new Uri(url, UriKind.Relative), TestJson.Options, ct);
        return response!;
    }
}
