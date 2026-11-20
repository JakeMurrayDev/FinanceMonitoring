using FinanceMonitoring.Api.Common.Endpoints;
using FinanceMonitoring.Api.Data;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Features.Transactions;

/// <summary>GET /api/transactions/{id}</summary>
public static class GetTransaction
{
    public sealed class Endpoint : IEndpoint
    {
        public void Map(IEndpointRouteBuilder app) =>
            app.MapGet("/transactions/{id:guid}", HandleAsync)
                .WithName(nameof(GetTransaction))
                .WithTags("Transactions")
                .WithSummary("Get one transaction.")
                .ProducesProblem(StatusCodes.Status404NotFound);

        internal static async Task<Results<Ok<TransactionResponse>, NotFound>> HandleAsync(
            Guid id,
            AppDbContext db,
            CancellationToken cancellationToken)
        {
            var transaction = await db.Transactions.AsNoTracking()
                .Where(t => t.Id == id)
                .Select(TransactionResponse.Projection)
                .FirstOrDefaultAsync(cancellationToken);

            return transaction is null ? TypedResults.NotFound() : TypedResults.Ok(transaction);
        }
    }
}
