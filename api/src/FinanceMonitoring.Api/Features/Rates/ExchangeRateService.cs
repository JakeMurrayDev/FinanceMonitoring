using System.Collections.Concurrent;

namespace FinanceMonitoring.Api.Features.Rates;

/// <summary>A rate ready to use, with how fresh it is.</summary>
/// <param name="Base">Currency converted from (always USD here).</param>
/// <param name="Quote">Currency converted to.</param>
/// <param name="Rate">Units of <paramref name="Quote"/> per one <paramref name="Base"/>. Exact decimal.</param>
/// <param name="Date">ECB publication date.</param>
/// <param name="Stale">True when Frankfurter couldn't be reached and this is the last good rate.</param>
public sealed record ExchangeRate(string Base, string Quote, decimal Rate, DateOnly Date, bool Stale);

public sealed class RatesUnavailableException(string message, Exception? inner = null) : Exception(message, inner);

public interface IExchangeRateService
{
    /// <summary>USD → <paramref name="quote"/>. Throws <see cref="RatesUnavailableException"/> when there's no rate at all.</summary>
    Task<ExchangeRate> GetUsdRateAsync(string quote, CancellationToken cancellationToken);

    /// <summary>Supported currency codes and names. Throws <see cref="RatesUnavailableException"/> if never loaded.</summary>
    Task<IReadOnlyDictionary<string, string>> GetCurrenciesAsync(CancellationToken cancellationToken);
}

/// <summary>
/// Caches Frankfurter responses in memory and degrades gracefully:
/// <list type="bullet">
/// <item>Fresh cache hit: no network call. Rates are published once a working day, so an hour is plenty.</item>
/// <item>Frankfurter down: the last good rate is served, marked <c>Stale</c>, and the UI says so.</item>
/// <item>Down with nothing cached: <see cref="RatesUnavailableException"/>, which becomes a 503.</item>
/// </list>
/// </summary>
public sealed class ExchangeRateService(
    IFrankfurterClient frankfurter, TimeProvider clock, ILogger<ExchangeRateService> logger) : IExchangeRateService
{
    public const string BaseCurrency = "USD";
    public static readonly TimeSpan RateTtl = TimeSpan.FromHours(1);
    public static readonly TimeSpan CurrencyListTtl = TimeSpan.FromHours(24);

    private readonly ConcurrentDictionary<string, Cached<PublishedRate>> _rates = new(StringComparer.Ordinal);
    private Cached<IReadOnlyDictionary<string, string>>? _currencies;

    // One refresh at a time, so a burst of requests after expiry makes one call, not dozens.
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    public async Task<ExchangeRate> GetUsdRateAsync(string quote, CancellationToken cancellationToken)
    {
        var (rate, stale) = await GetOrRefreshAsync(
            () => _rates.GetValueOrDefault(quote),
            value => _rates[quote] = value,
            RateTtl,
            ct => frankfurter.GetLatestAsync(BaseCurrency, quote, ct),
            $"{BaseCurrency}/{quote} rate",
            cancellationToken);

        return new ExchangeRate(rate.Base, rate.Quote, rate.Rate, rate.Date, stale);
    }

    public async Task<IReadOnlyDictionary<string, string>> GetCurrenciesAsync(CancellationToken cancellationToken)
    {
        var (currencies, _) = await GetOrRefreshAsync(
            () => _currencies,
            value => _currencies = value,
            CurrencyListTtl,
            frankfurter.GetCurrenciesAsync,
            "currency list",
            cancellationToken);
        return currencies;
    }

    private async Task<(T Value, bool Stale)> GetOrRefreshAsync<T>(
        Func<Cached<T>?> read,
        Action<Cached<T>> write,
        TimeSpan ttl,
        Func<CancellationToken, Task<T>> fetch,
        string what,
        CancellationToken cancellationToken)
    {
        if (read() is { } fresh && clock.GetUtcNow() - fresh.FetchedAt < ttl)
        {
            return (fresh.Value, false);
        }

        await _refreshLock.WaitAsync(cancellationToken);
        try
        {
            // Another request may have refreshed while we waited.
            if (read() is { } refreshed && clock.GetUtcNow() - refreshed.FetchedAt < ttl)
            {
                return (refreshed.Value, false);
            }

            try
            {
                var value = await fetch(cancellationToken);
                write(new Cached<T>(value, clock.GetUtcNow()));
                return (value, false);
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or InvalidDataException
                                           && !cancellationToken.IsCancellationRequested)
            {
                if (read() is { } lastGood)
                {
                    logger.LogWarning(ex, "Couldn't refresh the {What}; serving the cached copy from {FetchedAt}.", what, lastGood.FetchedAt);
                    return (lastGood.Value, true);
                }

                throw new RatesUnavailableException($"The {what} is unavailable right now.", ex);
            }
        }
        finally
        {
            _refreshLock.Release();
        }
    }

    private sealed record Cached<T>(T Value, DateTimeOffset FetchedAt);
}
