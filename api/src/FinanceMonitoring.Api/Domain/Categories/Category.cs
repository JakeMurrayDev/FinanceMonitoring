namespace FinanceMonitoring.Api.Domain.Categories;

/// <summary>A fixed reference list; every transaction and budget points at one.</summary>
public sealed class Category
{
    /// <summary>Stable URL-friendly slug, e.g. "groceries". Used in filter URLs.</summary>
    public required string Id { get; init; }

    public required string Name { get; init; }

    /// <summary>Whether this category applies to income or expense transactions.</summary>
    public required TransactionType Type { get; init; }
}
