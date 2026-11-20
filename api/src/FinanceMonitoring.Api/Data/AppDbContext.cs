using FinanceMonitoring.Api.Domain.Budgets;
using FinanceMonitoring.Api.Domain.Categories;
using FinanceMonitoring.Api.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Transaction> Transactions => Set<Transaction>();

    public DbSet<Budget> Budgets => Set<Budget>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
}
