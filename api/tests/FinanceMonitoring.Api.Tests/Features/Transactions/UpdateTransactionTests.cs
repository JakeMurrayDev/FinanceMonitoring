using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Features.Transactions;
using FinanceMonitoring.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using static FinanceMonitoring.Api.Tests.Features.Transactions.TransactionRequests;

namespace FinanceMonitoring.Api.Tests.Features.Transactions;

public sealed class UpdateTransactionTests(FinanceApiFactory factory) : IClassFixture<FinanceApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Replaces_the_transaction_and_increments_its_version()
    {
        var ct = TestContext.Current.CancellationToken;
        var original = await _client.CreateAsync();
        var update = UpdateFrom(original) with
        {
            Description = "Salary — October",
            Amount = 485_000,
            Type = TransactionType.Income,
            CategoryId = "salary",
        };

        using var response = await _client.PutAsJsonAsync(Url(original.Id), update, TestJson.Options, ct);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var updated = await response.Content.ReadFromJsonAsync<TransactionResponse>(TestJson.Options, ct);
        updated.Should().BeEquivalentTo(new
        {
            original.Id,
            Description = "Salary — October",
            Amount = 485_000L,
            Type = TransactionType.Income,
            CategoryName = "Salary",
            Version = 2L,
        });
    }

    [Fact]
    public async Task Rejects_a_stale_version_with_409_and_leaves_the_data_unchanged()
    {
        var ct = TestContext.Current.CancellationToken;
        var original = await _client.CreateAsync();

        // Two people open the same transaction (version 1). The first saves…
        using var first = await _client.PutAsJsonAsync(
            Url(original.Id), UpdateFrom(original) with { Amount = 1_000 }, TestJson.Options, ct);
        first.StatusCode.Should().Be(HttpStatusCode.OK);

        // …then the second saves from their now-stale copy.
        using var second = await _client.PutAsJsonAsync(
            Url(original.Id), UpdateFrom(original) with { Amount = 2_000 }, TestJson.Options, ct);

        second.StatusCode.Should().Be(HttpStatusCode.Conflict);
        var problem = await second.Content.ReadFromJsonAsync<ProblemDetails>(TestJson.Options, ct);
        problem!.Title.Should().Be("This transaction was changed by someone else.");
        ((JsonElement)problem.Extensions["currentVersion"]!).GetInt64().Should().Be(2);

        var current = await _client.GetFromJsonAsync<TransactionResponse>(Url(original.Id), TestJson.Options, ct);
        current!.Amount.Should().Be(1_000, "the first save wins and the second does not overwrite it");
    }

    [Fact]
    public async Task Applies_the_same_business_rules_as_create()
    {
        var ct = TestContext.Current.CancellationToken;
        var original = await _client.CreateAsync();

        using var response = await _client.PutAsJsonAsync(
            Url(original.Id), UpdateFrom(original) with { CategoryId = "salary" }, TestJson.Options, ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(TestJson.Options, ct);
        problem!.Errors.Should().ContainKey("categoryId");
    }

    [Fact]
    public async Task Returns_404_for_an_unknown_id()
    {
        var ct = TestContext.Current.CancellationToken;
        var request = UpdateFrom(await _client.CreateAsync());

        using var response = await _client.PutAsJsonAsync(Url(Guid.CreateVersion7()), request, TestJson.Options, ct);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }
}
