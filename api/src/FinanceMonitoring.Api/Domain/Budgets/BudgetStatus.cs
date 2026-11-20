namespace FinanceMonitoring.Api.Domain.Budgets;

public enum BudgetStatus
{
    NoBudget,
    OnTrack,
    NearLimit,
    OverBudget,
}

/// <summary>
/// How spending compares with a budget. Integer arithmetic only, so 80% is
/// exactly 80%. The rules are pinned by fixtures/budgets/status-cases.json,
/// which the frontend's twin implementation also runs.
/// </summary>
public static class BudgetMath
{
    /// <summary>At or above this share of the budget, a category is "near its limit".</summary>
    public const int NearLimitPercent = 80;

    public static BudgetStatus Status(long spent, long? budget) => budget switch
    {
        null => BudgetStatus.NoBudget,
        _ when spent > budget => BudgetStatus.OverBudget,
        // spent / budget >= 80 / 100, cross-multiplied to stay in integers.
        // Safe from overflow: amounts are capped at 2^53, so x100 still fits in a long.
        _ when spent * 100 >= budget * NearLimitPercent => BudgetStatus.NearLimit,
        _ => BudgetStatus.OnTrack,
    };

    /// <summary>Whole percent used, rounded down (so 99.9% shows as 99%, never "100%" while under).</summary>
    public static int? PercentUsed(long spent, long? budget) =>
        budget is { } b ? (int)Math.Min(spent * 100 / b, int.MaxValue) : null;
}
