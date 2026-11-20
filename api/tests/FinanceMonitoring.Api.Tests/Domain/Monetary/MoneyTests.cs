using FinanceMonitoring.Api.Domain.Monetary;

namespace FinanceMonitoring.Api.Tests.Domain.Monetary;

public sealed class MoneyTests
{
    private static Money Usd(long amount) => new(amount, Currency.Usd);

    private static Money Eur(long amount) => new(amount, Currency.Eur);

    // ── Construction ───────────────────────────────────────────────────────

    [Fact]
    public void Accepts_the_largest_amount_a_browser_can_represent()
    {
        Usd(Money.MaxAmount).Amount.Should().Be(9_007_199_254_740_991);
        Usd(-Money.MaxAmount).Amount.Should().Be(-9_007_199_254_740_991);
    }

    [Theory]
    [InlineData(Money.MaxAmount + 1)]
    [InlineData(-Money.MaxAmount - 1)]
    [InlineData(long.MaxValue)]
    public void Rejects_amounts_beyond_javascripts_safe_integer_range(long amount)
    {
        var act = () => Usd(amount);

        act.Should().Throw<MoneyException>().Which.Code.Should().Be(MoneyErrorCode.OutOfRange);
    }

    // ── Arithmetic ─────────────────────────────────────────────────────────

    [Fact]
    public void Avoids_the_classic_point_one_plus_point_two_error()
    {
        (0.1 + 0.2).Should().NotBe(0.3); // the floating-point bug we are avoiding

        (Usd(10) + Usd(20)).Should().Be(Usd(30));
    }

    [Fact]
    public void Adds_subtracts_and_negates()
    {
        (Usd(1999) + Usd(1)).Should().Be(Usd(2000));
        (Usd(500) - Usd(1250)).Should().Be(Usd(-750));
        (-Usd(500)).Should().Be(Usd(-500));
    }

    [Fact]
    public void Refuses_to_combine_different_currencies()
    {
        var add = () => Usd(100) + Eur(100);
        var subtract = () => Usd(100) - Eur(100);
        var compare = () => Usd(100) < Eur(100);

        add.Should().Throw<MoneyException>().Which.Code.Should().Be(MoneyErrorCode.CurrencyMismatch);
        subtract.Should().Throw<MoneyException>().Which.Code.Should().Be(MoneyErrorCode.CurrencyMismatch);
        compare.Should().Throw<MoneyException>().Which.Code.Should().Be(MoneyErrorCode.CurrencyMismatch);
    }

    [Fact]
    public void Throws_instead_of_overflowing()
    {
        var act = () => Usd(Money.MaxAmount) + Usd(1);

        act.Should().Throw<MoneyException>().Which.Code.Should().Be(MoneyErrorCode.OutOfRange);
    }

    [Fact]
    public void Sums_a_list_and_returns_zero_in_the_given_currency_when_empty()
    {
        Money.Sum([Usd(1050), Usd(-250), Usd(1)], Currency.Usd).Should().Be(Usd(801));
        Money.Sum([], Currency.Eur).Should().Be(Money.Zero(Currency.Eur));
    }

    [Fact]
    public void Compares_and_sorts()
    {
        (Usd(1) < Usd(2)).Should().BeTrue();
        (Usd(2) >= Usd(2)).Should().BeTrue();

        List<Money> amounts = [Usd(300), Usd(-50), Usd(100)];
        amounts.Sort();

        amounts.Should().Equal(Usd(-50), Usd(100), Usd(300));
    }

    // ── Conversion (happy paths live in ConversionParityTests) ─────────────

    [Theory]
    [InlineData("0")]
    [InlineData("-1.1")]
    public void Rejects_non_positive_rates(string rate)
    {
        var act = () => Usd(100).ConvertTo(Currency.Eur, decimal.Parse(rate, System.Globalization.CultureInfo.InvariantCulture));

        act.Should().Throw<MoneyException>().Which.Code.Should().Be(MoneyErrorCode.InvalidRate);
    }

    [Fact]
    public void Throws_if_the_converted_amount_is_out_of_range()
    {
        var act = () => Usd(Money.MaxAmount).ConvertTo(Currency.Eur, 2m);

        act.Should().Throw<MoneyException>().Which.Code.Should().Be(MoneyErrorCode.OutOfRange);
    }

    // ── Output ─────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(123456, "USD", "1234.56")]
    [InlineData(7, "USD", "0.07")]
    [InlineData(-5, "USD", "-0.05")]
    [InlineData(0, "USD", "0.00")]
    [InlineData(Money.MaxAmount, "USD", "90071992547409.91")]
    [InlineData(1500, "JPY", "1500")]
    [InlineData(1, "KWD", "0.001")]
    public void Formats_as_an_exact_decimal_string(long amount, string currency, string expected)
    {
        new Money(amount, Currency.FromCode(currency)).ToDecimalString().Should().Be(expected);
    }
}
