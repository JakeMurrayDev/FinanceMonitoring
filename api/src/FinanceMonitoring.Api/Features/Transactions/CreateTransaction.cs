using System.ComponentModel.DataAnnotations;
using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Monetary;
using FinanceMonitoring.Api.Domain.Transactions;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Transactions;

/// <summary>POST /api/transactions</summary>
public static class CreateTransaction
{
    // ── Request ────────────────────────────────────────────────────────────
    /// <param name="Date">Calendar date (yyyy-MM-dd). Not in the future.</param>
    /// <param name="Description">Payee or note, 1–200 characters.</param>
    /// <param name="Amount">Positive integer minor units (cents). Never a decimal.</param>
    /// <param name="Currency">ISO 4217 code. Only USD is supported for now.</param>
    /// <param name="Type">Income or Expense.</param>
    /// <param name="CategoryId">A category whose type matches <paramref name="Type"/>.</param>
    public sealed record Request(
        DateOnly Date,
        [property: Required(ErrorMessage = "Enter a description."), StringLength(200, ErrorMessage = "Use 200 characters or fewer.")] string Description,
        [property: Range(typeof(long), "1", "9007199254740991", ErrorMessage = "Enter an amount greater than zero.")] long Amount,
        [property: Required, AllowedValues("USD", ErrorMessage = "Only USD is supported.")] string Currency,
        TransactionType Type,
        [property: Required(ErrorMessage = "Choose a category."), StringLength(32)] string CategoryId);

    // ── Endpoint ───────────────────────────────────────────────────────────
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapPost("/transactions", HandleAsync)
                .WithName(nameof(CreateTransaction))
                .WithTags("Transactions")
                .WithSummary("Record a new transaction.")
                .ProducesValidationProblem();

        internal static async Task<Results<Created<TransactionResponse>, ValidationProblem>> HandleAsync(
            Request request,
            AppDbContext db,
            TimeProvider clock,
            CancellationToken cancellationToken)
        {
            var errors = await TransactionRules.ValidateAsync(
                request.Date, request.Type, request.CategoryId, db, clock, cancellationToken);
            if (errors.Count > 0)
            {
                return TypedResults.ValidationProblem(errors);
            }

            var now = clock.GetUtcNow();
            var transaction = new Transaction
            {
                Date = request.Date,
                Description = request.Description.Trim(),
                Amount = request.Amount,
                Currency = request.Currency,
                Type = request.Type,
                CategoryId = request.CategoryId,
                CreatedAt = now,
                UpdatedAt = now,
            };

            db.Transactions.Add(transaction);
            await db.SaveChangesAsync(cancellationToken);

            var response = await db.Transactions.AsNoTracking()
                .Where(t => t.Id == transaction.Id)
                .Select(TransactionResponse.Projection)
                .SingleAsync(cancellationToken);

            return TypedResults.Created($"/api/transactions/{transaction.Id}", response);
        }
    }
}
