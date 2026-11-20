using System.ComponentModel.DataAnnotations;
using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Common.Paging;
using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Transactions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Transactions;

/// <summary>
/// GET /api/transactions?search=coffee&amp;type=Expense&amp;category=dining&amp;category=groceries
/// &amp;from=2026-06-01&amp;to=2026-11-20&amp;sort=Date&amp;dir=Desc&amp;page=1&amp;pageSize=25
/// </summary>
public static class ListTransactions
{
    public const int MaxPageSize = 100;

    public enum SortField
    {
        Date,
        Amount,
        Description,
        Category,
    }

    // ── Request ────────────────────────────────────────────────────────────
    /// <param name="Search">Case-insensitive match anywhere in the description.</param>
    /// <param name="Type">Income or Expense; omit for both.</param>
    /// <param name="Category">Category ids. Repeat the parameter to match any of several.</param>
    /// <param name="From">Inclusive start date (yyyy-MM-dd).</param>
    /// <param name="To">Inclusive end date (yyyy-MM-dd).</param>
    /// <param name="Sort">Column to sort by. Amount sorts by signed value, so expenses come before income.</param>
    /// <param name="Dir">Sort direction.</param>
    /// <param name="Page">1-based page number.</param>
    /// <param name="PageSize">Rows per page, 1–100.</param>
    public sealed record Request(
        [FromQuery(Name = "search")][property: StringLength(100)] string? Search = null,
        [FromQuery(Name = "type")] TransactionType? Type = null,
        [FromQuery(Name = "category")] string[]? Category = null,
        [FromQuery(Name = "from")] DateOnly? From = null,
        [FromQuery(Name = "to")] DateOnly? To = null,
        [FromQuery(Name = "sort")] SortField Sort = SortField.Date,
        [FromQuery(Name = "dir")] SortDirection Dir = SortDirection.Desc,
        [FromQuery(Name = "page")][property: Range(1, int.MaxValue)] int Page = 1,
        [FromQuery(Name = "pageSize")][property: Range(1, MaxPageSize)] int PageSize = 25) : IValidatableObject
    {
        public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
        {
            if (From > To)
            {
                yield return new ValidationResult("'from' must be on or before 'to'.", [nameof(From)]);
            }
        }
    }

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapGet("/transactions", HandleAsync)
                .WithName(nameof(ListTransactions))
                .WithTags("Transactions")
                .WithSummary("Search, filter, sort and page through transactions.")
                .ProducesValidationProblem();

        internal static async Task<Ok<PagedResponse<TransactionResponse>>> HandleAsync(
            [AsParameters] Request request,
            AppDbContext db,
            CancellationToken cancellationToken)
        {
            var query = Filter(db.Transactions.AsNoTracking(), request);

            var response = await Sort(query, request.Sort, request.Dir).ToPagedResponseAsync(
                TransactionResponse.Projection,
                request.Page,
                request.PageSize,
                cancellationToken);

            return TypedResults.Ok(response);
        }

        private static IQueryable<Transaction> Filter(IQueryable<Transaction> query, Request request)
        {
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                // Escape LIKE wildcards so a search for "100%" means the literal text.
                var pattern = $"%{EscapeLike(request.Search.Trim())}%";
                query = query.Where(t => EF.Functions.Like(t.Description, pattern, LikeEscape));
            }

            if (request.Type is { } type)
            {
                query = query.Where(t => t.Type == type);
            }

            if (request.Category is { Length: > 0 } categories)
            {
                query = query.Where(t => categories.Contains(t.CategoryId));
            }

            if (request.From is { } from)
            {
                query = query.Where(t => t.Date >= from);
            }

            if (request.To is { } to)
            {
                query = query.Where(t => t.Date <= to);
            }

            return query;
        }

        private static IOrderedQueryable<Transaction> Sort(
            IQueryable<Transaction> query, SortField field, SortDirection dir)
        {
            var ordered = field switch
            {
                SortField.Amount => query.OrderBy(
                    t => t.Type == TransactionType.Expense ? -t.Amount : t.Amount, dir),
                SortField.Description => query.OrderBy(t => t.Description, dir),
                SortField.Category => query.OrderBy(t => t.Category.Name, dir),
                _ => query.OrderBy(t => t.Date, dir),
            };

            // Tiebreaker: without a unique final key, rows with equal sort values
            // can swap between page requests and appear twice or not at all.
            return ordered.ThenBy(t => t.Id, dir);
        }

        private const string LikeEscape = "\\";

        private static string EscapeLike(string value) =>
            value.Replace(LikeEscape, LikeEscape + LikeEscape, StringComparison.Ordinal)
                .Replace("%", LikeEscape + "%", StringComparison.Ordinal)
                .Replace("_", LikeEscape + "_", StringComparison.Ordinal);
    }
}
