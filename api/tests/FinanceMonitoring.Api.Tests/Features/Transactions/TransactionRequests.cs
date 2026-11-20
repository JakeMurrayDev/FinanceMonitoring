using System.Net.Http.Json;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Features.Transactions;
using FinanceMonitoring.Api.Tests.Infrastructure;

namespace FinanceMonitoring.Api.Tests.Features.Transactions;

/// <summary>Builders and HTTP helpers shared by the create/get/update/delete tests.</summary>
internal static class TransactionRequests
{
    public static CreateTransaction.Request ValidCreate() => new(
        Date: new DateOnly(2026, 11, 19),
        Description: "Sushi Ran",
        Amount: 9_800,
        Currency: "USD",
        Type: TransactionType.Expense,
        CategoryId: "dining");

    public static UpdateTransaction.Request UpdateFrom(TransactionResponse current) => new(
        current.Date, current.Description, current.Amount, current.Currency, current.Type, current.CategoryId, current.Version);

    public static async Task<TransactionResponse> CreateAsync(this HttpClient client, CreateTransaction.Request? request = null)
    {
        var ct = TestContext.Current.CancellationToken;
        using var response = await client.PostAsJsonAsync(
            new Uri("/api/transactions", UriKind.Relative), request ?? ValidCreate(), TestJson.Options, ct);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<TransactionResponse>(TestJson.Options, ct))!;
    }

    public static Uri Url(Guid id, long? version = null) =>
        new(version is null ? $"/api/transactions/{id}" : $"/api/transactions/{id}?version={version}", UriKind.Relative);
}
