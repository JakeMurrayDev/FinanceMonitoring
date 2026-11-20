using System.Text.Json;
using FinanceMonitoring.Api.Domain.Budgets;
using FinanceMonitoring.Api.Tests.Infrastructure;

namespace FinanceMonitoring.Api.Tests.Domain.Budgets;

/// <summary>
/// Runs fixtures/budgets/status-cases.json. The frontend's budgetStatus runs
/// the same file, so its optimistic updates can never disagree with the server.
/// </summary>
public sealed class BudgetStatusParityTests
{
    public static TheoryData<string, long, long?, BudgetStatus, int?> Cases()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "fixtures", "budgets", "status-cases.json");
        var fixture = JsonSerializer.Deserialize<FixtureFile>(File.ReadAllText(path), TestJson.Options)!;

        var data = new TheoryData<string, long, long?, BudgetStatus, int?>();
        foreach (var c in fixture.Cases) data.Add(c.Name, c.Spent, c.Budget, c.Status, c.PercentUsed);
        return data;
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void Matches_the_shared_fixture(string name, long spent, long? budget, BudgetStatus status, int? percentUsed)
    {
        BudgetMath.Status(spent, budget).Should().Be(status, because: name);
        BudgetMath.PercentUsed(spent, budget).Should().Be(percentUsed, because: name);
    }

    private sealed record FixtureFile(IReadOnlyList<FixtureCase> Cases);

    private sealed record FixtureCase(string Name, long Spent, long? Budget, BudgetStatus Status, int? PercentUsed);
}
