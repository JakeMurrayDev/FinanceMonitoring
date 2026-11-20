using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Domain;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Categories;

/// <summary>GET /api/categories?type=Expense</summary>
public static class ListCategories
{
    // ── Request ────────────────────────────────────────────────────────────
    /// <param name="Type">Optional filter; omit to list every category.</param>
    public sealed record Request(TransactionType? Type);

    // ── Response ───────────────────────────────────────────────────────────
    public sealed record Response(IReadOnlyList<CategoryItem> Categories);

    public sealed record CategoryItem(string Id, string Name, TransactionType Type);

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapGet("/categories", HandleAsync)
                .WithName(nameof(ListCategories))
                .WithTags("Categories")
                .WithSummary("List transaction categories, optionally filtered by type.");

        internal static async Task<Ok<Response>> HandleAsync(
            [AsParameters] Request request,
            AppDbContext db,
            CancellationToken cancellationToken)
        {
            var query = db.Categories.AsNoTracking();

            if (request.Type is { } type)
            {
                query = query.Where(c => c.Type == type);
            }

            var categories = await query
                .OrderBy(c => c.Name)
                .Select(c => new CategoryItem(c.Id, c.Name, c.Type))
                .ToListAsync(cancellationToken);

            return TypedResults.Ok(new Response(categories));
        }
    }
}
