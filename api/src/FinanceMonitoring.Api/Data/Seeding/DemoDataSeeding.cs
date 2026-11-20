using FinanceMonitoring.Api.Domain.Budgets;
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
                if (!context.Set<Transaction>().Any()) context.Set<Transaction>().AddRange(DemoData.Generate(today));
                if (!context.Set<Budget>().Any()) context.Set<Budget>().AddRange(DemoData.GenerateBudgets(today));
                context.SaveChanges();
            })
            .UseAsyncSeeding(async (context, _, cancellationToken) =>
            {
                // Each table is seeded independently, so an existing database
                // created before budgets existed still gets demo budgets.
                if (!await context.Set<Transaction>().AnyAsync(cancellationToken))
                {
                    context.Set<Transaction>().AddRange(DemoData.Generate(today));
                }

                if (!await context.Set<Budget>().AnyAsync(cancellationToken))
                {
                    context.Set<Budget>().AddRange(DemoData.GenerateBudgets(today));
                }

                await context.SaveChangesAsync(cancellationToken);
            });
    }
}
