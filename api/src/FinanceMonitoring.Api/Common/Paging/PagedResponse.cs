namespace FinanceMonitoring.Api.Common.Paging;

/// <summary>Standard envelope for any paginated list endpoint.</summary>
/// <param name="Items">The rows on this page.</param>
/// <param name="Page">1-based page number.</param>
/// <param name="PageSize">Requested rows per page.</param>
/// <param name="TotalCount">Rows matching the filters, across all pages.</param>
/// <param name="TotalPages">Number of pages at this page size (0 when nothing matches).</param>
public sealed record PagedResponse<T>(IReadOnlyList<T> Items, int Page, int PageSize, int TotalCount, int TotalPages)
{
    public static PagedResponse<T> Create(IReadOnlyList<T> items, int page, int pageSize, int totalCount) =>
        new(items, page, pageSize, totalCount, (totalCount + pageSize - 1) / pageSize);
}
