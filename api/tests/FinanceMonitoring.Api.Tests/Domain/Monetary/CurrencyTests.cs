using FinanceMonitoring.Api.Domain.Monetary;

namespace FinanceMonitoring.Api.Tests.Domain.Monetary;

public sealed class CurrencyTests
{
    [Theory]
    [InlineData("USD", 2)]
    [InlineData("EUR", 2)]
    [InlineData("GBP", 2)]
    [InlineData("JPY", 0)]
    [InlineData("KRW", 0)]
    [InlineData("KWD", 3)]
    [InlineData("BHD", 3)]
    public void Knows_the_minor_units_of_each_currency(string code, int expectedMinorUnits)
    {
        Currency.FromCode(code).MinorUnits.Should().Be(expectedMinorUnits);
    }

    [Theory]
    [InlineData("usd")]
    [InlineData("US")]
    [InlineData("USDD")]
    [InlineData("U$D")]
    [InlineData("")]
    public void Rejects_malformed_codes(string code)
    {
        var act = () => Currency.FromCode(code);

        act.Should().Throw<MoneyException>().Which.Code.Should().Be(MoneyErrorCode.InvalidCurrency);
    }

    [Fact]
    public void Currencies_with_the_same_code_are_equal()
    {
        Currency.FromCode("USD").Should().Be(Currency.Usd);
    }
}
