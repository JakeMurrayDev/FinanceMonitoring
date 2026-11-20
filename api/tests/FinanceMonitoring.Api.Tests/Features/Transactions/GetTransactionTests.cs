using System.Net;
using FinanceMonitoring.Api.Tests.Infrastructure;
using static FinanceMonitoring.Api.Tests.Features.Transactions.TransactionRequests;

namespace FinanceMonitoring.Api.Tests.Features.Transactions;

public sealed class GetTransactionTests(FinanceApiFactory factory) : IClassFixture<FinanceApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Returns_404_problem_details_for_an_unknown_id()
    {
        var ct = TestContext.Current.CancellationToken;

        using var response = await _client.GetAsync(Url(Guid.CreateVersion7()), ct);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/problem+json");
    }
}
