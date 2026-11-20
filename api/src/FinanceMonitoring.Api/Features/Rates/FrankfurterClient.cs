using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FinanceMonitoring.Api.Features.Rates;

/// <summary>A rate as published by the ECB via Frankfurter.</summary>
/// <param name="Base">Currency being converted from, e.g. USD.</param>
/// <param name="Quote">Currency being converted to, e.g. EUR.</param>
/// <param name="Rate">Units of <paramref name="Quote"/> per one <paramref name="Base"/>. Exact decimal.</param>
/// <param name="Date">The ECB publication date of the rate.</param>
public sealed record PublishedRate(string Base, string Quote, decimal Rate, DateOnly Date);

/// <summary>The Frankfurter API (https://frankfurter.dev): free ECB reference rates, published each working day.</summary>
public interface IFrankfurterClient
{
    Task<PublishedRate> GetLatestAsync(string @base, string quote, CancellationToken cancellationToken);

    /// <summary>Supported currencies: ISO code → English name.</summary>
    Task<IReadOnlyDictionary<string, string>> GetCurrenciesAsync(CancellationToken cancellationToken);
}

public sealed class FrankfurterClient(HttpClient http) : IFrankfurterClient
{
    public async Task<PublishedRate> GetLatestAsync(string @base, string quote, CancellationToken cancellationToken)
    {
        var url = new Uri($"latest?base={Uri.EscapeDataString(@base)}&symbols={Uri.EscapeDataString(quote)}", UriKind.Relative);
        using var response = await http.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();

        await using var body = await response.Content.ReadAsStreamAsync(cancellationToken);
        var latest = await JsonSerializer.DeserializeAsync<LatestResponse>(body, JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("Empty response from Frankfurter.");

        if (!latest.Rates.TryGetValue(quote, out var rate) || rate <= 0)
        {
            throw new InvalidDataException($"Frankfurter returned no usable {quote} rate.");
        }

        return new PublishedRate(latest.Base, quote, rate, DateOnly.Parse(latest.Date, CultureInfo.InvariantCulture));
    }

    public async Task<IReadOnlyDictionary<string, string>> GetCurrenciesAsync(CancellationToken cancellationToken)
    {
        var currencies = await http.GetFromJsonAsync<Dictionary<string, string>>(
            new Uri("currencies", UriKind.Relative), JsonOptions, cancellationToken);
        return currencies ?? throw new InvalidDataException("Empty response from Frankfurter.");
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    // Rates are read straight into decimal: System.Text.Json parses the JSON
    // number's text, so 0.90975 becomes exactly 0.90975m, never a binary double.
    private sealed record LatestResponse(
        [property: JsonPropertyName("base")] string Base,
        [property: JsonPropertyName("date")] string Date,
        [property: JsonPropertyName("rates")] Dictionary<string, decimal> Rates);
}
