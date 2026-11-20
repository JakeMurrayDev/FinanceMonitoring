using System.Net;
using System.Net.Http.Json;
using FinanceMonitoring.Api.Features.Rates;
using FinanceMonitoring.Api.Tests.Infrastructure;
using NSubstitute.ExceptionExtensions;

namespace FinanceMonitoring.Api.Tests.Features.Rates;

public sealed class ListCurrenciesTests(FinanceApiFactory factory) : IClassFixture<FinanceApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    [Fact]
    public async Task Lists_supported_currencies_by_code_including_usd()
    {
        var ct = TestContext.Current.CancellationToken;
        factory.Rates.GetCurrenciesAsync(Arg.Any<CancellationToken>())
            .Returns(new Dictionary<string, string> { ["JPY"] = "Japanese Yen", ["EUR"] = "Euro" });

        var response = await _client.GetFromJsonAsync<ListCurrencies.Response>(
            new Uri("/api/currencies", UriKind.Relative), TestJson.Options, ct);

        response!.Currencies.Select(c => c.Code).Should().Equal("EUR", "JPY", "USD");
    }

    [Fact]
    public async Task Returns_503_when_the_list_is_unavailable()
    {
        var ct = TestContext.Current.CancellationToken;
        factory.Rates.GetCurrenciesAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new RatesUnavailableException("The currency list is unavailable right now."));

        using var response = await _client.GetAsync(new Uri("/api/currencies", UriKind.Relative), ct);

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
    }
}
