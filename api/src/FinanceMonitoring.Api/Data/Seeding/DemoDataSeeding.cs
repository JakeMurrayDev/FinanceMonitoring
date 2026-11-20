using FinanceMonitoring.Api.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Data.Seeding;

public static class DemoDataSeeding
{
    /// <summary>
    /// Registers EF Core's seeding hooks, which run after <c>Migrate()</c>. Seeds
    /// only into an empty table, so restarting the API never duplicates data.
    /// </summary>
    public static DbContextOptionsBuilder UseDemoData(this DbContextOptionsBuilder options, TimeProvider clock)
    {
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);

        // EF tooling uses the sync hook and the app uses the async one; both are required.
        return options
            .UseSeeding((context, _) =>
            {
                var transactions = context.Set<Transaction>();
                if (transactions.Any()) return;
                transactions.AddRange(DemoData.Generate(today));
                context.SaveChanges();
            })
            .UseAsyncSeeding(async (context, _, cancellationToken) =>
            {
                var transactions = context.Set<Transaction>();
                if (await transactions.AnyAsync(cancellationToken)) return;
                transactions.AddRange(DemoData.Generate(today));
                await context.SaveChangesAsync(cancellationToken);
            });
    }
}
