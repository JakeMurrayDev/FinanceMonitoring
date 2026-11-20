using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Common.Paging;

public static class QueryableExtensions
{
    public static IOrderedQueryable<T> OrderBy<T, TKey>(
        this IQueryable<T> query, Expression<Func<T, TKey>> key, SortDirection direction) =>
        direction == SortDirection.Asc ? query.OrderBy(key) : query.OrderByDescending(key);

    public static IOrderedQueryable<T> ThenBy<T, TKey>(
        this IOrderedQueryable<T> query, Expression<Func<T, TKey>> key, SortDirection direction) =>
        direction == SortDirection.Asc ? query.ThenBy(key) : query.ThenByDescending(key);

    /// <summary>Count the full result set, then fetch one page of it.</summary>
    public static async Task<PagedResponse<TResult>> ToPagedResponseAsync<T, TResult>(
        this IOrderedQueryable<T> query,
        Expression<Func<T, TResult>> projection,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(projection)
            .ToListAsync(cancellationToken);

        return PagedResponse<TResult>.Create(items, page, pageSize, totalCount);
    }
}
