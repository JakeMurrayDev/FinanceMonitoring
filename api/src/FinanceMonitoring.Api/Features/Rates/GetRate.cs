using System.ComponentModel.DataAnnotations;
using System.Globalization;
using FinanceMonitoring.Api.Common.Endpoints;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace FinanceMonitoring.Api.Features.Rates;

/// <summary>
/// GET /api/rates/EUR: the rate the web app uses to show transactions and
/// budgets in a display currency. Those pages keep their data in USD (it's
/// what they edit) and convert only for display, with the same exact-decimal,
/// round-half-to-even maths the server uses for the dashboard.
/// </summary>
public static class GetRate
{
    // ── Request ────────────────────────────────────────────────────────────
    /// <param name="Currency">Currency to convert USD into (ISO 4217).</param>
    public sealed record Request(
        [FromRoute(Name = "currency")][property: RegularExpression(DisplayRate.CodePattern, ErrorMessage = DisplayRate.CodeMessage)] string Currency);

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapGet("/rates/{currency}", HandleAsync)
                .WithName(nameof(GetRate))
                .WithTags("Rates")
                .WithSummary("The latest USD rate for a display currency.")
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        internal static async Task<Results<Ok<RateInfo>, ValidationProblem, ProblemHttpResult>> HandleAsync(
            [AsParameters] Request request,
            IExchangeRateService rates,
            TimeProvider clock,
            CancellationToken cancellationToken)
        {
            var lookup = await DisplayRate.ResolveAsync(request.Currency, rates, cancellationToken);
            if (lookup.Invalid is { } invalid) return invalid;
            if (lookup.Unavailable is { } unavailable) return unavailable;

            // USD needs no conversion: answer with the identity rate rather
            // than an error, so a client never has to special-case it.
            return TypedResults.Ok(lookup.Rate is { } rate
                ? RateInfo.From(rate)
                : new RateInfo(ExchangeRateService.BaseCurrency, ExchangeRateService.BaseCurrency, "1",
                    DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                    Stale: false));
        }
    }
}

/// <summary>How amounts were converted: returned on its own and inside the dashboard.</summary>
/// <param name="Base">Converted from (USD).</param>
/// <param name="Quote">Converted to.</param>
/// <param name="Rate">Units of quote per one base, as an exact decimal string (never a float).</param>
/// <param name="Date">ECB publication date (yyyy-MM-dd).</param>
/// <param name="Stale">True when the rate source was unreachable and this is the last good rate.</param>
public sealed record RateInfo(string Base, string Quote, string Rate, string Date, bool Stale)
{
    public static RateInfo From(ExchangeRate rate) => new(
        rate.Base,
        rate.Quote,
        rate.Rate.ToString(CultureInfo.InvariantCulture),
        rate.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        rate.Stale);
}

/// <summary>The outcome of looking up a display currency: a rate, or the reason there isn't one.</summary>
/// <param name="Rate">The USD rate, or null when the currency is USD and nothing needs converting.</param>
/// <param name="Invalid">Set when the currency isn't supported (400).</param>
/// <param name="Unavailable">Set when no rate can be had right now (503).</param>
internal readonly record struct RateLookup(ExchangeRate? Rate, ValidationProblem? Invalid, ProblemHttpResult? Unavailable);

/// <summary>Shared by every endpoint that takes a display currency, so they validate and fail the same way.</summary>
internal static class DisplayRate
{
    public const string CodePattern = "^[A-Z]{3}$";
    public const string CodeMessage = "Use a 3-letter currency code, e.g. EUR.";

    public static async Task<RateLookup> ResolveAsync(
        string currency, IExchangeRateService rates, CancellationToken cancellationToken)
    {
        if (currency == ExchangeRateService.BaseCurrency) return default;

        try
        {
            // Fail fast, before the caller does any work.
            var supported = await rates.GetCurrenciesAsync(cancellationToken);
            if (!supported.ContainsKey(currency))
            {
                return new RateLookup(null, TypedResults.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["currency"] = [$"{currency} isn't a supported currency."],
                }), null);
            }

            return new RateLookup(await rates.GetUsdRateAsync(currency, cancellationToken), null, null);
        }
        catch (RatesUnavailableException ex)
        {
            return new RateLookup(null, null, RatesProblem.Unavailable(ex.Message));
        }
    }
}
