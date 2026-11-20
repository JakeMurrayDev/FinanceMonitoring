using System.Globalization;

namespace FinanceMonitoring.Api.Domain.Monetary;

/// <summary>
/// An amount in integer <b>minor units</b> (cents, yen, fils) plus its currency.
/// The C# twin of <c>web/src/lib/money</c>.
/// </summary>
public sealed record Money : IComparable<Money>
{
    /// <summary>
    /// 2^53 − 1, JavaScript's <c>Number.MAX_SAFE_INTEGER</c>. Amounts are sent to
    /// the browser as JSON numbers; anything larger would silently lose precision
    /// there, so the API refuses to create it in the first place.
    /// </summary>
    public const long MaxAmount = 9_007_199_254_740_991;

    public Money(long amount, Currency currency)
    {
        ArgumentNullException.ThrowIfNull(currency);
        if (amount is > MaxAmount or < -MaxAmount)
        {
            throw new MoneyException(
                MoneyErrorCode.OutOfRange,
                $"Amount {amount} is outside the range a browser can represent exactly");
        }

        Amount = amount;
        Currency = currency;
    }

    public long Amount { get; }

    public Currency Currency { get; }

    public static Money Zero(Currency currency) => new(0, currency);

    // ── Arithmetic ─────────────────────────────────────────────────────────
    // Two amounts within ±2^53 can't overflow a long when added, and the
    // constructor rejects any result outside ±2^53.

    public static Money operator +(Money left, Money right)
    {
        EnsureSameCurrency(left, right);
        return new Money(left.Amount + right.Amount, left.Currency);
    }

    public static Money operator -(Money left, Money right)
    {
        EnsureSameCurrency(left, right);
        return new Money(left.Amount - right.Amount, left.Currency);
    }

    public static Money operator -(Money value) => new(-value.Amount, value.Currency);

    public static Money Sum(IEnumerable<Money> values, Currency currency) =>
        values.Aggregate(Zero(currency), (total, next) => total + next);

    // ── Comparison ─────────────────────────────────────────────────────────

    public int CompareTo(Money? other)
    {
        if (other is null) return 1;
        EnsureSameCurrency(this, other);
        return Amount.CompareTo(other.Amount);
    }

    public static bool operator <(Money left, Money right) => left.CompareTo(right) < 0;
    public static bool operator >(Money left, Money right) => left.CompareTo(right) > 0;
    public static bool operator <=(Money left, Money right) => left.CompareTo(right) <= 0;
    public static bool operator >=(Money left, Money right) => left.CompareTo(right) >= 0;

    // ── Conversion ─────────────────────────────────────────────────────────

    /// <summary>
    /// Convert using <paramref name="rate"/> = units of <paramref name="target"/> per one unit
    /// of this currency (Frankfurter's shape). Rounds once, half-to-even.
    /// </summary>
    /// <remarks>
    /// <see cref="decimal"/> is base-10, so 0.92345 is stored exactly and the
    /// multiplication is exact. The frontend has no decimal type and gets the
    /// same result with BigInt. Never use <see cref="double"/> here.
    /// </remarks>
    public Money ConvertTo(Currency target, decimal rate)
    {
        ArgumentNullException.ThrowIfNull(target);
        if (rate <= 0)
        {
            throw new MoneyException(MoneyErrorCode.InvalidRate, $"Exchange rate must be positive, got {rate}");
        }

        var exponent = target.MinorUnits - Currency.MinorUnits;
        var scaled = Amount * rate * Pow10(exponent);
        var rounded = decimal.Round(scaled, 0, MidpointRounding.ToEven);

        if (rounded is > MaxAmount or < -MaxAmount)
        {
            throw new MoneyException(MoneyErrorCode.OutOfRange, $"Converted amount {rounded} is out of range");
        }

        return new Money((long)rounded, target);
    }

    // ── Output ─────────────────────────────────────────────────────────────

    /// <summary>Exact major-unit string: 123456 USD → "1234.56", 1500 JPY → "1500".</summary>
    public string ToDecimalString() =>
        (Amount / Pow10(Currency.MinorUnits)).ToString($"F{Currency.MinorUnits}", CultureInfo.InvariantCulture);

    public override string ToString() => $"{ToDecimalString()} {Currency.Code}";

    private static void EnsureSameCurrency(Money left, Money right)
    {
        if (left.Currency != right.Currency)
        {
            throw new MoneyException(
                MoneyErrorCode.CurrencyMismatch,
                $"Cannot combine {left.Currency} with {right.Currency}; convert first");
        }
    }

    private static decimal Pow10(int exponent)
    {
        var result = 1m;
        for (var i = 0; i < Math.Abs(exponent); i++) result *= 10m;
        return exponent >= 0 ? result : 1m / result;
    }
}
