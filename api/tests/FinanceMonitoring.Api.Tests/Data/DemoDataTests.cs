using System.Net.Http.Json;
using FinanceMonitoring.Api.Common.Paging;
using FinanceMonitoring.Api.Data.Seeding;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Budgets;
using FinanceMonitoring.Api.Domain.Transactions;
using FinanceMonitoring.Api.Features.Budgets;
using FinanceMonitoring.Api.Features.Transactions;
using FinanceMonitoring.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace FinanceMonitoring.Api.Tests.Data;

public sealed class DemoDataTests
{
    private static readonly DateOnly Today = new(2026, 11, 20);

    private readonly IReadOnlyList<Transaction> _transactions = DemoData.Generate(Today);

    [Fact]
    public void Generates_roughly_one_hundred_transactions()
    {
        _transactions.Count.Should().BeInRange(90, 130);
    }

    [Fact]
    public void Covers_the_last_six_months_and_never_the_future()
    {
        _transactions.Should().OnlyContain(t => t.Date <= Today && t.Date >= Today.AddMonths(-6));
        _transactions.Max(t => t.Date).Should().BeOnOrAfter(Today.AddDays(-7), "recent activity makes the demo feel live");
        _transactions.Min(t => t.Date).Should().BeOnOrBefore(Today.AddMonths(-5));
    }

    [Fact]
    public void Contains_only_valid_amounts_and_both_transaction_types()
    {
        _transactions.Should().OnlyContain(t => t.Amount > 0 && t.Currency == "USD");
        _transactions.Should().Contain(t => t.Type == TransactionType.Income)
            .And.Contain(t => t.Type == TransactionType.Expense);
    }

    [Fact]
    public void Is_deterministic_for_the_same_date_and_seed()
    {
        var again = DemoData.Generate(Today);

        // Ids embed random bits, so compare everything else.
        again.Should().BeEquivalentTo(_transactions, options => options
            .Excluding(t => t.Id)
            .WithStrictOrdering());
    }

    [Fact]
    public void Produces_different_data_for_a_different_seed()
    {
        var other = DemoData.Generate(Today, seed: 1);

        other.Select(t => t.Amount).Should().NotEqual(_transactions.Select(t => t.Amount));
    }

    [Fact]
    public async Task Seeds_into_a_real_database_on_startup()
    {
        // Proves the generated rows satisfy the schema: foreign keys to real
        // categories, the positive-amount check constraint, column lengths.
        var ct = TestContext.Current.CancellationToken;
        var clock = new FakeTimeProvider(new DateTimeOffset(2026, 11, 20, 12, 0, 0, TimeSpan.Zero));
        clock.SetLocalTimeZone(TimeZoneInfo.Utc);

        await using var baseFactory = new FinanceApiFactory();
        using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Database:SeedDemoData", "true");
            builder.ConfigureTestServices(services => services.AddSingleton<TimeProvider>(clock));
        });
        using var client = factory.CreateClient();

        var page = await client.GetFromJsonAsync<PagedResponse<TransactionResponse>>(
            new Uri("/api/transactions?pageSize=1", UriKind.Relative), TestJson.Options, ct);

        page!.TotalCount.Should().Be(_transactions.Count);

        // The demo budgets are tuned so the Budgets page shows every status.
        var budgets = await client.GetFromJsonAsync<GetBudgets.Response>(
            new Uri("/api/budgets?month=2026-11", UriKind.Relative), TestJson.Options, ct);
        budgets!.Lines.Select(l => l.Status).Distinct().Should().BeEquivalentTo(Enum.GetValues<BudgetStatus>());
    }

    [Fact]
    public void Generates_effective_dated_budgets_for_expense_categories()
    {
        var budgets = DemoData.GenerateBudgets(Today);

        budgets.Should().OnlyContain(b => b.EffectiveFrom.Day == 1 && b.Amount > 0);
        budgets.Where(b => b.CategoryId == "dining").Should().HaveCount(2, "Dining Out was raised partway through");
        budgets.Should().NotContain(b => b.CategoryId == "salary");
    }
}
