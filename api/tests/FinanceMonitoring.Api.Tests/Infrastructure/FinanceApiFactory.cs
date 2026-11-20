using FinanceMonitoring.Api.Data;
using FinanceMonitoring.Api.Domain.Transactions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace FinanceMonitoring.Api.Tests.Infrastructure;

/// <summary>
/// Boots the real API in memory, backed by a private in-memory SQLite database,
/// so integration tests exercise routing, EF Core, migrations and serialization.
/// </summary>
public sealed class FinanceApiFactory : WebApplicationFactory<Program>
{
    // A named in-memory SQLite database lives only while a connection to it is
    // open, so this connection is held for the factory's lifetime.
    private readonly string _connectionString =
        $"Data Source=finance-tests-{Guid.NewGuid():N};Mode=Memory;Cache=Shared";

    private readonly SqliteConnection _keepAlive;

    public FinanceApiFactory()
    {
        _keepAlive = new SqliteConnection(_connectionString);
        _keepAlive.Open();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Finance", _connectionString);
        builder.UseSetting("Database:MigrateOnStartup", "true");
        builder.ConfigureLogging(logging => logging.ClearProviders()); // keep test output readable
    }

    /// <summary>Insert rows directly, bypassing the API, to set up a known state.</summary>
    public async Task SeedAsync(IEnumerable<Transaction> transactions, CancellationToken cancellationToken)
    {
        await using var scope = Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Transactions.AddRange(transactions);
        await db.SaveChangesAsync(cancellationToken);
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _keepAlive.Dispose();
        }
    }
}
