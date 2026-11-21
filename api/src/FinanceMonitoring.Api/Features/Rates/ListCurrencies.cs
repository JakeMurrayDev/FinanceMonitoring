using FinanceMonitoring.Api.Common.Endpoints;
using Microsoft.AspNetCore.Http.HttpResults;

namespace FinanceMonitoring.Api.Features.Rates;

/// <summary>GET /api/currencies</summary>
public static class ListCurrencies
{
    // ── Response ───────────────────────────────────────────────────────────
    /// <param name="Currencies">Display currencies, by code. Always includes USD, the account currency.</param>
    public sealed record Response(IReadOnlyList<CurrencyItem> Currencies);

    /// <param name="Code">ISO 4217 code.</param>
    /// <param name="Name">English name.</param>
    public sealed record CurrencyItem(string Code, string Name);

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapGet("/currencies", HandleAsync)
                .WithName(nameof(ListCurrencies))
                .WithTags("Rates")
                .WithSummary("Currencies amounts can be displayed in.")
                .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        internal static async Task<Results<Ok<Response>, ProblemHttpResult>> HandleAsync(
            IExchangeRateService rates, CancellationToken cancellationToken)
        {
            try
            {
                var currencies = await rates.GetCurrenciesAsync(cancellationToken);
                var items = currencies
                    .Select(pair => new CurrencyItem(pair.Key, pair.Value))
                    .Append(new CurrencyItem("USD", "US Dollar"))
                    .DistinctBy(item => item.Code)
                    .OrderBy(item => item.Code, StringComparer.Ordinal)
                    .ToList();
                return TypedResults.Ok(new Response(items));
            }
            catch (RatesUnavailableException ex)
            {
                return RatesProblem.Unavailable(ex.Message);
            }
        }
    }
}

internal static class RatesProblem
{
    public static ProblemHttpResult Unavailable(string detail) =>
        TypedResults.Problem(
            statusCode: StatusCodes.Status503ServiceUnavailable,
            title: "Exchange rates are unavailable right now.",
            detail: detail + " Amounts can still be shown in USD.");
}
