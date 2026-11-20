using System.Linq.Expressions;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Domain.Transactions;

namespace FinanceMonitoring.Api.Features.Transactions;

/// <summary>A transaction as returned by every transactions endpoint.</summary>
/// <param name="Id">Unique, time-ordered identifier.</param>
/// <param name="Date">Calendar date of the transaction (yyyy-MM-dd).</param>
/// <param name="Description">Payee or note.</param>
/// <param name="Amount">Positive integer minor units (cents). Direction is given by <paramref name="Type"/>.</param>
/// <param name="Currency">ISO 4217 code of <paramref name="Amount"/>.</param>
/// <param name="Type">Income or Expense.</param>
/// <param name="CategoryId">Category slug, usable in the <c>category</c> filter.</param>
/// <param name="CategoryName">Display name of the category.</param>
/// <param name="Version">Concurrency token. Send it back when updating or deleting.</param>
public sealed record TransactionResponse(
    Guid Id,
    DateOnly Date,
    string Description,
    long Amount,
    string Currency,
    TransactionType Type,
    string CategoryId,
    string CategoryName,
    long Version)
{
    /// <summary>Translatable to SQL, so EF Core selects only these columns.</summary>
    public static readonly Expression<Func<Transaction, TransactionResponse>> Projection = t =>
        new TransactionResponse(
            t.Id, t.Date, t.Description, t.Amount, t.Currency, t.Type, t.CategoryId, t.Category.Name, t.Version);
}
