using System.Net;
using FinanceMonitoring.Api.Tests.Infrastructure;
using static FinanceMonitoring.Api.Tests.Features.Transactions.TransactionRequests;

namespace FinanceMonitoring.Api.Tests.Features.Transactions;

public sealed class DeleteTransactionTests(FinanceApiFactory factory) : IClassFixture<FinanceApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Deletes_with_the_current_version()
    {
        var ct = TestContext.Current.CancellationToken;
        var transaction = await _client.CreateAsync();

        using var response = await _client.DeleteAsync(Url(transaction.Id, transaction.Version), ct);

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        using var after = await _client.GetAsync(Url(transaction.Id), ct);
        after.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Refuses_a_stale_version_with_409_and_keeps_the_transaction()
    {
        var ct = TestContext.Current.CancellationToken;
        var transaction = await _client.CreateAsync();

        using var response = await _client.DeleteAsync(Url(transaction.Id, version: 99), ct);

        response.StatusCode.Should().Be(HttpStatusCode.Conflict);
        using var after = await _client.GetAsync(Url(transaction.Id), ct);
        after.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Returns_404_for_an_unknown_id()
    {
        var ct = TestContext.Current.CancellationToken;

        using var response = await _client.DeleteAsync(Url(Guid.CreateVersion7(), version: 1), ct);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Requires_a_version()
    {
        var ct = TestContext.Current.CancellationToken;
        var transaction = await _client.CreateAsync();

        using var response = await _client.DeleteAsync(Url(transaction.Id), ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }
}
