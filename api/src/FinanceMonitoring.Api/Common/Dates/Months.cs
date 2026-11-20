using System.Diagnostics.CodeAnalysis;
using System.Globalization;

namespace FinanceMonitoring.Api.Common.Dates;

/// <summary>
/// Months travel over the API as "yyyy-MM" strings and are stored as the
/// first day of the month.
/// </summary>
public static class Months
{
    public const string Pattern = @"^\d{4}-(0[1-9]|1[0-2])$";

    public static bool TryParse(string? value, [NotNullWhen(true)] out DateOnly? firstDay)
    {
        firstDay = null;
        if (value is null
            || !DateOnly.TryParseExact(value + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            return false;
        }

        firstDay = date;
        return true;
    }

    /// <summary>A 400 for a value that matches the pattern but isn't a real month (e.g. "0000-01").</summary>
    public static Microsoft.AspNetCore.Http.HttpResults.ValidationProblem Invalid(string field = "month") =>
        Microsoft.AspNetCore.Http.TypedResults.ValidationProblem(
            new Dictionary<string, string[]> { [field] = ["Use a real month in the format yyyy-MM."] });

    public static string Format(DateOnly date) => date.ToString("yyyy-MM", CultureInfo.InvariantCulture);

    public static DateOnly FirstDayOf(DateOnly date) => new(date.Year, date.Month, 1);

    public static DateOnly CurrentMonth(TimeProvider clock) =>
        FirstDayOf(DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime));
}
