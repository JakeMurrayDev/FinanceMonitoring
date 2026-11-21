using System.Net;
using System.Net.Http.Json;
using FinanceMonitoring.Api.Features.Rates;
using FinanceMonitoring.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using NSubstitute.ExceptionExtensions;

namespace FinanceMonitoring.Api.Tests.Features.Rates;

public sealed class GetRateTests : IClassFixture<FinanceApiFactory>
{
    private static readonly DateOnly EcbDate = new(2026, 11, 19);
    private readonly HttpClient _client;
    private readonly IExchangeRateService _rates;

    public GetRateTests(FinanceApiFactory factory)
    {
        _client = factory.CreateClient();
        _rates = factory.Rates;
        _rates.ClearReceivedCalls();
        _rates.GetCurrenciesAsync(Arg.Any<CancellationToken>())
            .Returns(new Dictionary<string, string> { ["EUR"] = "Euro", ["JPY"] = "Japanese Yen" });
        _rates.GetUsdRateAsync("EUR", Arg.Any<CancellationToken>())
            .Returns(new ExchangeRate("USD", "EUR", 0.92345m, EcbDate, Stale: false));
    }

    [Fact]
    public async Task Returns_the_rate_as_an_exact_decimal_string_with_its_ecb_date()
    {
        var rate = await GetAsync("EUR");

        rate.Should().Be(new RateInfo("USD", "EUR", "0.92345", "2026-11-19", Stale: false));
    }

    [Fact]
    public async Task Passes_on_a_stale_rate_so_the_ui_can_warn()
    {
        _rates.GetUsdRateAsync("EUR", Arg.Any<CancellationToken>())
            .Returns(new ExchangeRate("USD", "EUR", 0.92345m, EcbDate, Stale: true));

        var rate = await GetAsync("EUR");

        rate.Stale.Should().BeTrue();
    }

    [Fact]
    public async Task Answers_usd_with_the_identity_rate_without_touching_exchange_rates()
    {
        var rate = await GetAsync("USD");

        rate.Should().Be(new RateInfo("USD", "USD", "1", "2026-11-20", Stale: false));
        await _rates.DidNotReceive().GetUsdRateAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
        await _rates.DidNotReceive().GetCurrenciesAsync(Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData("GBP")] // well-formed but not in the supported list
    [InlineData("eur")]
    [InlineData("EURO")]
    public async Task Rejects_an_unsupported_currency(string currency)
    {
        var ct = TestContext.Current.CancellationToken;

        using var response = await _client.GetAsync(new Uri($"/api/rates/{currency}", UriKind.Relative), ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        var problem = await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(TestJson.Options, ct);
        problem!.Errors.Keys.Should().ContainSingle(key => key.Equals("currency", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Returns_503_when_no_rate_is_available()
    {
        var ct = TestContext.Current.CancellationToken;
        _rates.GetUsdRateAsync("JPY", Arg.Any<CancellationToken>())
            .ThrowsAsync(new RatesUnavailableException("The USD/JPY rate is unavailable right now."));

        using var response = await _client.GetAsync(new Uri("/api/rates/JPY", UriKind.Relative), ct);

        response.StatusCode.Should().Be(HttpStatusCode.ServiceUnavailable);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(TestJson.Options, ct);
        problem!.Title.Should().Be("Exchange rates are unavailable right now.");
    }

    private async Task<RateInfo> GetAsync(string currency) =>
        (await _client.GetFromJsonAsync<RateInfo>(
            new Uri($"/api/rates/{currency}", UriKind.Relative), TestJson.Options, TestContext.Current.CancellationToken))!;
}
