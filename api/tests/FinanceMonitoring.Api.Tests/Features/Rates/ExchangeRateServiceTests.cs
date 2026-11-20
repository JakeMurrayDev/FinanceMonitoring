using FinanceMonitoring.Api.Features.Rates;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;
using NSubstitute.ExceptionExtensions;

namespace FinanceMonitoring.Api.Tests.Features.Rates;

public sealed class ExchangeRateServiceTests
{
    private static readonly DateOnly EcbDate = new(2026, 11, 19);

    private readonly IFrankfurterClient _frankfurter = Substitute.For<IFrankfurterClient>();
    private readonly FakeTimeProvider _clock = new(new DateTimeOffset(2026, 11, 20, 12, 0, 0, TimeSpan.Zero));
    private readonly ExchangeRateService _service;

    public ExchangeRateServiceTests()
    {
        _service = new ExchangeRateService(_frankfurter, _clock, NullLogger<ExchangeRateService>.Instance);
        PublishEur(0.92345m);
    }

    private void PublishEur(decimal rate) =>
        _frankfurter.GetLatestAsync("USD", "EUR", Arg.Any<CancellationToken>())
            .Returns(new PublishedRate("USD", "EUR", rate, EcbDate));

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Serves_repeat_requests_from_cache_within_the_hour()
    {
        var first = await _service.GetUsdRateAsync("EUR", Ct);
        _clock.Advance(TimeSpan.FromMinutes(59));
        var second = await _service.GetUsdRateAsync("EUR", Ct);

        second.Should().Be(first);
        second.Should().Be(new ExchangeRate("USD", "EUR", 0.92345m, EcbDate, Stale: false));
        await _frankfurter.Received(1).GetLatestAsync("USD", "EUR", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Refreshes_once_the_hour_is_up()
    {
        await _service.GetUsdRateAsync("EUR", Ct);
        PublishEur(0.93m);
        _clock.Advance(TimeSpan.FromMinutes(61));

        var refreshed = await _service.GetUsdRateAsync("EUR", Ct);

        refreshed.Rate.Should().Be(0.93m);
        await _frankfurter.Received(2).GetLatestAsync("USD", "EUR", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Caches_each_currency_separately()
    {
        _frankfurter.GetLatestAsync("USD", "GBP", Arg.Any<CancellationToken>())
            .Returns(new PublishedRate("USD", "GBP", 0.76m, EcbDate));

        await _service.GetUsdRateAsync("EUR", Ct);
        await _service.GetUsdRateAsync("GBP", Ct);
        await _service.GetUsdRateAsync("EUR", Ct);

        await _frankfurter.Received(1).GetLatestAsync("USD", "EUR", Arg.Any<CancellationToken>());
        await _frankfurter.Received(1).GetLatestAsync("USD", "GBP", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Falls_back_to_the_last_good_rate_marked_stale_when_the_source_is_down()
    {
        await _service.GetUsdRateAsync("EUR", Ct);
        _clock.Advance(TimeSpan.FromHours(2));
        _frankfurter.GetLatestAsync("USD", "EUR", Arg.Any<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("Connection refused"));

        var rate = await _service.GetUsdRateAsync("EUR", Ct);

        rate.Should().Be(new ExchangeRate("USD", "EUR", 0.92345m, EcbDate, Stale: true));
    }

    [Fact]
    public async Task Fails_clearly_when_there_is_no_rate_at_all()
    {
        _frankfurter.GetLatestAsync("USD", "EUR", Arg.Any<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("Connection refused"));

        var act = () => _service.GetUsdRateAsync("EUR", Ct);

        await act.Should().ThrowAsync<RatesUnavailableException>()
            .WithMessage("The USD/EUR rate is unavailable right now.");
    }

    [Fact]
    public async Task Makes_one_call_when_many_requests_arrive_after_expiry()
    {
        var gate = new TaskCompletionSource<PublishedRate>();
        _frankfurter.GetLatestAsync("USD", "EUR", Arg.Any<CancellationToken>()).Returns(gate.Task);

        var requests = Enumerable.Range(0, 5).Select(_ => _service.GetUsdRateAsync("EUR", Ct)).ToList();
        gate.SetResult(new PublishedRate("USD", "EUR", 0.92345m, EcbDate));
        var results = await Task.WhenAll(requests);

        results.Should().OnlyContain(r => r.Rate == 0.92345m);
        await _frankfurter.Received(1).GetLatestAsync("USD", "EUR", Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Caches_the_currency_list_for_a_day_with_the_same_fallback()
    {
        _frankfurter.GetCurrenciesAsync(Arg.Any<CancellationToken>())
            .Returns(new Dictionary<string, string> { ["EUR"] = "Euro" });

        await _service.GetCurrenciesAsync(Ct);
        _clock.Advance(TimeSpan.FromHours(23));
        await _service.GetCurrenciesAsync(Ct);
        await _frankfurter.Received(1).GetCurrenciesAsync(Arg.Any<CancellationToken>());

        _clock.Advance(TimeSpan.FromHours(2));
        _frankfurter.GetCurrenciesAsync(Arg.Any<CancellationToken>())
            .ThrowsAsync(new HttpRequestException("Connection refused"));
        (await _service.GetCurrenciesAsync(Ct)).Should().ContainKey("EUR");
    }
}
