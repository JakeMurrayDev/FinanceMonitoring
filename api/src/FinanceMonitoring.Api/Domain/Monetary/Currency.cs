using System.Collections.Frozen;
using System.Text.RegularExpressions;

namespace FinanceMonitoring.Api.Domain.Monetary;

/// <summary>An ISO 4217 currency and the number of decimal places in its minor unit.</summary>
public sealed partial record Currency
{
    // ISO 4217 currencies whose minor unit is not 2 decimal places.
    private static readonly FrozenSet<string> ZeroDecimal = FrozenSet.Create(
        StringComparer.Ordinal,
        "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF", "UGX", "UYI", "VND",
        "VUV", "XAF", "XOF", "XPF");

    private static readonly FrozenSet<string> ThreeDecimal = FrozenSet.Create(
        StringComparer.Ordinal,
        "BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND");

    public static readonly Currency Usd = FromCode("USD");
    public static readonly Currency Eur = FromCode("EUR");

    private Currency(string code, int minorUnits)
    {
        Code = code;
        MinorUnits = minorUnits;
    }

    /// <summary>Three-letter uppercase code, e.g. "USD".</summary>
    public string Code { get; }

    /// <summary>USD → 2 (cents), JPY → 0, KWD → 3 (fils).</summary>
    /// <remarks>
    /// The frontend gets this from Intl (CLDR data), which agrees with ISO 4217
    /// for every currency the Frankfurter API offers. The shared fixture
    /// <c>fixtures/money/conversion-cases.json</c> checks that both sides agree.
    /// </remarks>
    public int MinorUnits { get; }

    public static Currency FromCode(string code)
    {
        if (code is null || !CodePattern().IsMatch(code))
        {
            throw new MoneyException(MoneyErrorCode.InvalidCurrency, $"Invalid currency code: \"{code}\"");
        }

        var minorUnits = ZeroDecimal.Contains(code) ? 0 : ThreeDecimal.Contains(code) ? 3 : 2;
        return new Currency(code, minorUnits);
    }

    public override string ToString() => Code;

    [GeneratedRegex("^[A-Z]{3}$")]
    private static partial Regex CodePattern();
}
