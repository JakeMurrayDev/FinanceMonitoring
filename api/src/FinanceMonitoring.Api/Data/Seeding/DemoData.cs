using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Budgets;
using FinanceMonitoring.Api.Domain.Transactions;

namespace FinanceMonitoring.Api.Data.Seeding;

/// <summary>
/// Generates about 100 realistic transactions covering the six months before
/// <c>today</c>: monthly bills and salary, weekly groceries, and irregular
/// spending.
/// </summary>
/// <remarks>
/// A pure function of (<c>today</c>, <c>seed</c>): the same inputs always give
/// the same data, which keeps the demo stable and the generator easy to test.
/// </remarks>
public static class DemoData
{
    public const int DefaultSeed = 20261120;

    private const string Usd = "USD";

    private static readonly string[] Grocers = ["Whole Foods Market", "Trader Joe's", "Safeway", "Costco"];
    private static readonly string[] Restaurants =
        ["Blue Bottle Coffee", "Chipotle", "Sushi Ran", "Pizzeria Delfina", "Tartine Bakery", "Burma Superstar"];
    private static readonly string[] Shops = ["Amazon", "Target", "REI", "IKEA", "Uniqlo"];
    private static readonly string[] Outings = ["AMC Theatres", "Ticketmaster", "Bowling Night", "Museum Tickets"];

    public static IReadOnlyList<Transaction> Generate(DateOnly today, int seed = DefaultSeed)
    {
        var random = new Random(seed);
        var start = today.AddMonths(-6);
        var items = new List<Transaction>();

        void Add(DateOnly date, string description, long amount, TransactionType type, string category)
        {
            if (date < start || date > today) return; // never in the future, never before the window
            items.Add(new Transaction
            {
                Id = Guid.CreateVersion7(date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddMinutes(items.Count)),
                Date = date,
                Description = description,
                Amount = amount,
                Currency = Usd,
                Type = type,
                CategoryId = category,
                CreatedAt = date.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc),
                UpdatedAt = date.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc),
            });
        }

        long Between(long min, long max) => random.NextInt64(min, max + 1);
        T Pick<T>(T[] options) => options[random.Next(options.Length)];

        for (var month = new DateOnly(start.Year, start.Month, 1); month <= today; month = month.AddMonths(1))
        {
            DateOnly Day(int day) => new(month.Year, month.Month, Math.Min(day, DateTime.DaysInMonth(month.Year, month.Month)));

            // ── Fixed monthly items ───────────────────────────────────────
            Add(Day(1), "Payroll — Northwind Traders", 485_000, TransactionType.Income, "salary");
            Add(Day(1), "Rent — Maple Court Apartments", 165_000, TransactionType.Expense, "rent");
            Add(Day(6), "City Power & Light", Between(6_200, 11_800), TransactionType.Expense, "utilities");
            Add(Day(12), "Fibre Internet", 6_499, TransactionType.Expense, "utilities");
            Add(Day(8), "Netflix", 1_549, TransactionType.Expense, "subscriptions");
            Add(Day(15), "Spotify Premium", 1_199, TransactionType.Expense, "subscriptions");
            Add(Day(31), "Savings Account Interest", Between(310, 540), TransactionType.Income, "interest");

            // ── Weekly-ish groceries ──────────────────────────────────────
            for (var day = 2 + random.Next(3); day <= 28; day += 6 + random.Next(3))
            {
                Add(Day(day), Pick(Grocers), Between(3_800, 14_500), TransactionType.Expense, "groceries");
            }

            // ── Irregular spending ────────────────────────────────────────
            for (var i = 0; i < 2 + random.Next(2); i++)
            {
                Add(Day(1 + random.Next(28)), Pick(Restaurants), Between(650, 7_800), TransactionType.Expense, "dining");
            }

            Add(Day(3 + random.Next(25)), "Uber", Between(1_150, 3_900), TransactionType.Expense, "transport");
            Add(Day(3 + random.Next(25)), "Shell", Between(4_200, 6_900), TransactionType.Expense, "transport");

            if (random.Next(3) > 0)
            {
                Add(Day(1 + random.Next(28)), Pick(Shops), Between(1_999, 18_900), TransactionType.Expense, "shopping");
            }

            if (random.Next(2) == 0)
            {
                Add(Day(1 + random.Next(28)), Pick(Outings), Between(1_800, 9_500), TransactionType.Expense, "entertainment");
            }

            if (random.Next(3) == 0)
            {
                Add(Day(1 + random.Next(28)), "CVS Pharmacy", Between(899, 4_600), TransactionType.Expense, "health");
            }

            if (month.Month % 2 == 0)
            {
                Add(Day(18 + random.Next(8)), "Freelance — website project", Between(60_000, 180_000), TransactionType.Income, "freelance");
            }
        }

        // ── One trip, about two months ago ───────────────────────────────
        var trip = today.AddMonths(-2);
        Add(trip, "Alaska Airlines", 38_640, TransactionType.Expense, "travel");
        Add(trip.AddDays(3), "Hotel Zephyr", 54_210, TransactionType.Expense, "travel");

        return items.OrderBy(t => t.Date).ThenBy(t => t.Id).ToList();
    }

    /// <summary>
    /// Budgets that start six months before <paramref name="today"/>. Dining
    /// Out is raised two months ago (effective dating), Health and Travel have
    /// none, and Groceries and Dining are tight so the demo shows every status.
    /// </summary>
    public static IReadOnlyList<Budget> GenerateBudgets(DateOnly today)
    {
        var thisMonth = new DateOnly(today.Year, today.Month, 1);
        var start = thisMonth.AddMonths(-6);
        var created = start.ToDateTime(new TimeOnly(9, 0), DateTimeKind.Utc);

        Budget Row(string category, long amount, DateOnly from) => new()
        {
            CategoryId = category,
            EffectiveFrom = from,
            Amount = amount,
            Currency = Usd,
            CreatedAt = created,
            UpdatedAt = created,
        };

        return
        [
            Row("groceries", 30_000, start),
            Row("dining", 9_000, start), // raised below: effective dating
            Row("dining", 12_000, thisMonth.AddMonths(-2)),
            Row("rent", 165_000, start),
            Row("utilities", 20_000, start),
            Row("transport", 12_000, start),
            Row("subscriptions", 3_000, start),
            Row("entertainment", 6_000, start),
            Row("shopping", 15_000, start),
        ];
    }
}
