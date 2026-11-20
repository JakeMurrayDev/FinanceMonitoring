using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Common.Http;
using FinanceMonitoring.Api.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Transactions;

/// <summary>DELETE /api/transactions/{id}?version=3</summary>
public static class DeleteTransaction
{
    // ── Request ────────────────────────────────────────────────────────────
    /// <param name="Id">The transaction to delete.</param>
    /// <param name="Version">The version you last read. A mismatch means someone else changed it: 409.</param>
    public sealed record Request(Guid Id, [FromQuery(Name = "version")] long Version);

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapDelete("/transactions/{id:guid}", HandleAsync)
                .WithName(nameof(DeleteTransaction))
                .WithTags("Transactions")
                .WithSummary("Delete a transaction. Requires the current version.")
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict);

        internal static async Task<Results<NoContent, NotFound, ProblemHttpResult>> HandleAsync(
            [AsParameters] Request request,
            AppDbContext db,
            CancellationToken cancellationToken)
        {
            // One atomic statement: deletes only if the version still matches.
            var deleted = await db.Transactions
                .Where(t => t.Id == request.Id && t.Version == request.Version)
                .ExecuteDeleteAsync(cancellationToken);

            if (deleted == 1)
            {
                return TypedResults.NoContent();
            }

            // Nothing deleted: either it doesn't exist or the version is stale.
            var currentVersion = await db.Transactions
                .Where(t => t.Id == request.Id)
                .Select(t => (long?)t.Version)
                .FirstOrDefaultAsync(cancellationToken);

            return currentVersion is null ? TypedResults.NotFound() : ConflictProblem.For("transaction", currentVersion);
        }
    }
}
