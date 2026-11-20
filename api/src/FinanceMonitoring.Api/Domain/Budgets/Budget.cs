using FinanceMonitoring.Api.Domain.Categories;

namespace FinanceMonitoring.Api.Domain.Budgets;

/// <summary>
/// A monthly spending limit for one expense category, effective from
/// <see cref="EffectiveFrom"/> until a later row for the same category
/// replaces it.
/// </summary>
/// <remarks>
/// Effective dating keeps history accurate: raising the Groceries budget in
/// November adds a November row, so September and October are still judged
/// against the limit that applied then.
/// </remarks>
public sealed class Budget
{
    public Guid Id { get; init; } = Guid.CreateVersion7();

    public required string CategoryId { get; init; }

    public Category Category { get; set; } = null!;

    /// <summary>Always the first day of a month.</summary>
    public DateOnly EffectiveFrom { get; init; }

    /// <summary>Monthly limit in minor units, or <c>null</c> to clear the budget from this month on.</summary>
    public long? Amount { get; set; }

    public required string Currency { get; set; }

    /// <summary>Optimistic concurrency token, as on transactions.</summary>
    public long Version { get; set; } = 1;

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; set; }
}
