using System.Net;
using System.Text;
using FinanceMonitoring.Api.Features.Rates;

namespace FinanceMonitoring.Api.Tests.Features.Rates;

public sealed class FrankfurterClientTests
{
    private const string LatestJson =
        """{"amount":1.0,"base":"USD","date":"2026-11-19","rates":{"EUR":0.90975}}""";

    [Fact]
    public async Task Reads_the_rate_as_an_exact_decimal()
    {
        var handler = new StubHandler(HttpStatusCode.OK, LatestJson);
        var client = Create(handler);

        var rate = await client.GetLatestAsync("USD", "EUR", TestContext.Current.CancellationToken);

        rate.Should().Be(new PublishedRate("USD", "EUR", 0.90975m, new DateOnly(2026, 11, 19)));
        handler.LastRequest!.RequestUri!.PathAndQuery.Should().Be("/v1/latest?base=USD&symbols=EUR");
    }

    [Fact]
    public async Task Rejects_a_response_without_the_requested_rate()
    {
        var client = Create(new StubHandler(HttpStatusCode.OK, LatestJson));

        var act = () => client.GetLatestAsync("USD", "GBP", TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<InvalidDataException>();
    }

    [Fact]
    public async Task Surfaces_an_error_status_as_an_http_failure()
    {
        var client = Create(new StubHandler(HttpStatusCode.NotFound, """{"message":"not found"}"""));

        var act = () => client.GetLatestAsync("USD", "XYZ", TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<HttpRequestException>();
    }

    [Fact]
    public async Task Reads_the_currency_list()
    {
        var client = Create(new StubHandler(HttpStatusCode.OK, """{"EUR":"Euro","JPY":"Japanese Yen"}"""));

        var currencies = await client.GetCurrenciesAsync(TestContext.Current.CancellationToken);

        currencies.Should().BeEquivalentTo(new Dictionary<string, string> { ["EUR"] = "Euro", ["JPY"] = "Japanese Yen" });
    }

    private static FrankfurterClient Create(StubHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://api.frankfurter.dev/v1/") });

    /// <summary>Returns a canned response and records the request, so no network is used.</summary>
    private sealed class StubHandler(HttpStatusCode status, string json) : HttpMessageHandler
    {
        public HttpRequestMessage? LastRequest { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            LastRequest = request;
            return Task.FromResult(new HttpResponseMessage(status)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json"),
            });
        }
    }
}
