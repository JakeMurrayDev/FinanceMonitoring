using System.Net;
using System.Net.Http.Json;
using System.Text;
using FinanceMonitoring.Api.Domain;
using FinanceMonitoring.Api.Features.Transactions;
using FinanceMonitoring.Api.Tests.Infrastructure;
using Microsoft.AspNetCore.Mvc;
using static FinanceMonitoring.Api.Tests.Features.Transactions.TransactionRequests;

namespace FinanceMonitoring.Api.Tests.Features.Transactions;

public sealed class CreateTransactionTests(FinanceApiFactory factory) : IClassFixture<FinanceApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();
    private static readonly Uri Endpoint = new("/api/transactions", UriKind.Relative);

    [Fact]
    public async Task Creates_a_transaction_and_returns_201_with_its_location()
    {
        var ct = TestContext.Current.CancellationToken;

        using var response = await _client.PostAsJsonAsync(
            Endpoint, ValidCreate() with { Description = "  Sushi Ran  " }, TestJson.Options, ct);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<TransactionResponse>(TestJson.Options, ct);
        created.Should().BeEquivalentTo(new
        {
            Date = new DateOnly(2026, 11, 19),
            Description = "Sushi Ran", // trimmed
            Amount = 9_800L,
            Currency = "USD",
            Type = TransactionType.Expense,
            CategoryId = "dining",
            CategoryName = "Dining Out",
            Version = 1L,
        });
        response.Headers.Location.Should().Be($"/api/transactions/{created!.Id}");

        var fetched = await _client.GetFromJsonAsync<TransactionResponse>(response.Headers.Location, TestJson.Options, ct);
        fetched.Should().Be(created);
    }

    public static TheoryData<CreateTransaction.Request, string, string> InvalidRequests => new()
    {
        { ValidCreate() with { Amount = 0 }, "amount", "Enter an amount greater than zero." },
        { ValidCreate() with { Amount = -500 }, "amount", "Enter an amount greater than zero." },
        { ValidCreate() with { Amount = 9_007_199_254_740_992 }, "amount", "Enter an amount greater than zero." },
        { ValidCreate() with { Description = "" }, "description", "Enter a description." },
        { ValidCreate() with { Description = "   " }, "description", "Enter a description." },
        { ValidCreate() with { Description = new string('x', 201) }, "description", "Use 200 characters or fewer." },
        { ValidCreate() with { Currency = "EUR" }, "currency", "Only USD is supported." },
        { ValidCreate() with { CategoryId = "" }, "categoryId", "Choose a category." },
        { ValidCreate() with { CategoryId = "lottery" }, "categoryId", "Unknown category \"lottery\"." },
        { ValidCreate() with { CategoryId = "salary" }, "categoryId", "Salary is an income category." },
        { ValidCreate() with { Type = TransactionType.Income }, "categoryId", "Dining Out is an expense category." },
        // "Now" is 2026-11-20 UTC; one day of slack allows for time zones ahead of UTC.
        { ValidCreate() with { Date = new DateOnly(2026, 11, 22) }, "date", "Date can’t be in the future." },
    };

    [Theory]
    [MemberData(nameof(InvalidRequests))]
    public async Task Rejects_invalid_input_with_a_field_level_error(
        CreateTransaction.Request request, string field, string message)
    {
        var problem = await PostExpectingValidationProblemAsync(request);

        problem.Errors.Should().ContainKey(field).WhoseValue.Should().Contain(message);
    }

    [Fact]
    public async Task Allows_tomorrow_utc_for_users_ahead_of_utc()
    {
        var created = await _client.CreateAsync(ValidCreate() with { Date = new DateOnly(2026, 11, 21) });

        created.Date.Should().Be(new DateOnly(2026, 11, 21));
    }

    [Fact]
    public async Task Rejects_an_amount_sent_as_a_string()
    {
        var ct = TestContext.Current.CancellationToken;
        using var body = new StringContent(
            """{"date":"2026-11-19","description":"x","amount":"9800","currency":"USD","type":"Expense","categoryId":"dining"}""",
            Encoding.UTF8,
            "application/json");

        using var response = await _client.PostAsync(Endpoint, body, ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private async Task<ValidationProblemDetails> PostExpectingValidationProblemAsync(CreateTransaction.Request request)
    {
        var ct = TestContext.Current.CancellationToken;
        using var response = await _client.PostAsJsonAsync(Endpoint, request, TestJson.Options, ct);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        return (await response.Content.ReadFromJsonAsync<ValidationProblemDetails>(TestJson.Options, ct))!;
    }
}
