using FinanceMonitoring.Api.Domain.Categories;
using FinanceMonitoring.Api.Domain.Transactions;
using Microsoft.EntityFrameworkCore;

namespace FinanceMonitoring.Api.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Category> Categories => Set<Category>();

    public DbSet<Transaction> Transactions => Set<Transaction>();

    protected override void OnModelCreating(ModelBuilder modelBuilder) =>
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
}
