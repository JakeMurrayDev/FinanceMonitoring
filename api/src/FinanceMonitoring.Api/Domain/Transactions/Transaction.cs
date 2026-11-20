using FinanceMonitoring.Api.Domain.Categories;

namespace FinanceMonitoring.Api.Domain.Transactions;

public sealed class Transaction
{
    /// <summary>
    /// Version 7 GUID: the leading bits are a timestamp, so ids sort in creation
    /// order. Used as a tiebreaker so paging is stable when sort keys collide.
    /// </summary>
    public Guid Id { get; init; } = Guid.CreateVersion7();

    /// <summary>The calendar date of the transaction. No time component, so no time-zone bugs.</summary>
    public DateOnly Date { get; set; }

    public required string Description { get; set; }

    /// <summary>
    /// Always positive, in minor units. Direction comes from <see cref="Type"/>,
    /// which matches how people enter amounts ("$12.50 expense", not "−$12.50").
    /// </summary>
    public long Amount { get; set; }

    /// <summary>ISO 4217 code. All demo data is USD; Phase 5 converts for display.</summary>
    public required string Currency { get; set; }

    public TransactionType Type { get; set; }

    public required string CategoryId { get; set; }

    public Category Category { get; set; } = null!;

    /// <summary>
    /// Optimistic concurrency token. Incremented on every change; an update or
    /// delete must quote the version it read, or it's rejected with 409 rather
    /// than silently overwriting someone else's change.
    /// </summary>
    public long Version { get; set; } = 1;

    public DateTimeOffset CreatedAt { get; init; }

    public DateTimeOffset UpdatedAt { get; set; }
}
