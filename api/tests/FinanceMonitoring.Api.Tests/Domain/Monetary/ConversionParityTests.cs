using System.Globalization;
using System.Text.Json;
using FinanceMonitoring.Api.Domain.Monetary;

namespace FinanceMonitoring.Api.Tests.Domain.Monetary;

/// <summary>
/// Runs every case in <c>fixtures/money/conversion-cases.json</c>. The frontend's
/// Vitest suite runs the same file, so any change in rounding on either side
/// fails a test.
/// </summary>
public sealed class ConversionParityTests
{
    public static TheoryData<string, long, string, string, string, long> Cases()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "conversion-cases.json");
        var fixture = JsonSerializer.Deserialize<FixtureFile>(
            File.ReadAllText(path),
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

        var data = new TheoryData<string, long, string, string, string, long>();
        foreach (var c in fixture.Cases)
        {
            data.Add(c.Name, c.Amount, c.From, c.Rate, c.To, c.Expected);
        }

        return data;
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void Converts_exactly_like_the_frontend(
        string name, long amount, string from, string rate, string to, long expected)
    {
        var target = Currency.FromCode(to);
        var exactRate = decimal.Parse(rate, NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture);

        var result = new Money(amount, Currency.FromCode(from)).ConvertTo(target, exactRate);

        result.Should().Be(new Money(expected, target), because: name);
    }

    private sealed record FixtureFile(IReadOnlyList<FixtureCase> Cases);

    private sealed record FixtureCase(string Name, long Amount, string From, string Rate, string To, long Expected);
}
