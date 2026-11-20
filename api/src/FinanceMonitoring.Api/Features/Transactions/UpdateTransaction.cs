using System.ComponentModel.DataAnnotations;
using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Common.Http;
using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Domain;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Transactions;

/// <summary>PUT /api/transactions/{id}</summary>
public static class UpdateTransaction
{
    // ── Request ────────────────────────────────────────────────────────────
    /// <param name="Date">Calendar date (yyyy-MM-dd). Not in the future.</param>
    /// <param name="Description">Payee or note, 1–200 characters.</param>
    /// <param name="Amount">Positive integer minor units (cents). Never a decimal.</param>
    /// <param name="Currency">ISO 4217 code. Only USD is supported for now.</param>
    /// <param name="Type">Income or Expense.</param>
    /// <param name="CategoryId">A category whose type matches <paramref name="Type"/>.</param>
    /// <param name="Version">The version you last read. A mismatch means someone else changed it: 409.</param>
    public sealed record Request(
        DateOnly Date,
        [property: Required(ErrorMessage = "Enter a description."), StringLength(200, ErrorMessage = "Use 200 characters or fewer.")] string Description,
        [property: Range(typeof(long), "1", "9007199254740991", ErrorMessage = "Enter an amount greater than zero.")] long Amount,
        [property: Required, AllowedValues("USD", ErrorMessage = "Only USD is supported.")] string Currency,
        TransactionType Type,
        [property: Required(ErrorMessage = "Choose a category."), StringLength(32)] string CategoryId,
        [property: Range(1, long.MaxValue)] long Version);

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapPut("/transactions/{id:guid}", HandleAsync)
                .WithName(nameof(UpdateTransaction))
                .WithTags("Transactions")
                .WithSummary("Replace a transaction. Requires the current version.")
                .ProducesValidationProblem()
                .ProducesProblem(StatusCodes.Status404NotFound)
                .ProducesProblem(StatusCodes.Status409Conflict);

        internal static async Task<Results<Ok<TransactionResponse>, ValidationProblem, NotFound, ProblemHttpResult>> HandleAsync(
            Guid id,
            Request request,
            AppDbContext db,
            TimeProvider clock,
            CancellationToken cancellationToken)
        {
            var transaction = await db.Transactions.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
            if (transaction is null)
            {
                return TypedResults.NotFound();
            }

            if (transaction.Version != request.Version)
            {
                return ConflictProblem.For("transaction", transaction.Version);
            }

            var errors = await TransactionRules.ValidateAsync(
                request.Date, request.Type, request.CategoryId, db, clock, cancellationToken);
            if (errors.Count > 0)
            {
                return TypedResults.ValidationProblem(errors);
            }

            transaction.Date = request.Date;
            transaction.Description = request.Description.Trim();
            transaction.Amount = request.Amount;
            transaction.Currency = request.Currency;
            transaction.Type = request.Type;
            transaction.CategoryId = request.CategoryId;
            transaction.UpdatedAt = clock.GetUtcNow();
            transaction.Version = request.Version + 1;

            try
            {
                // EF adds "WHERE Version = <the version we loaded>" to the UPDATE, which
                // catches a change made between our read above and this write.
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                return ConflictProblem.For("transaction", currentVersion: null);
            }

            var response = await db.Transactions.AsNoTracking()
                .Where(t => t.Id == id)
                .Select(TransactionResponse.Projection)
                .SingleAsync(cancellationToken);

            return TypedResults.Ok(response);
        }
    }
}
