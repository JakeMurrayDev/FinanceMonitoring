using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace FinanceMonitoring.Api.Data.Migrations;

/// <inheritdoc />
public partial class _20261120085026_InitialCreate : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Categories",
            columns: table => new
            {
                Id = table.Column<string>(type: "TEXT", maxLength: 32, nullable: false),
                Name = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                Type = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Categories", x => x.Id);
            });

        migrationBuilder.InsertData(
            table: "Categories",
            columns: new[] { "Id", "Name", "Type" },
            values: new object[,]
            {
                { "dining", "Dining Out", "Expense" },
                { "entertainment", "Entertainment", "Expense" },
                { "freelance", "Freelance", "Income" },
                { "groceries", "Groceries", "Expense" },
                { "health", "Health", "Expense" },
                { "interest", "Interest & Dividends", "Income" },
                { "other-income", "Other Income", "Income" },
                { "rent", "Rent", "Expense" },
                { "salary", "Salary", "Income" },
                { "shopping", "Shopping", "Expense" },
                { "subscriptions", "Subscriptions", "Expense" },
                { "transport", "Transport", "Expense" },
                { "travel", "Travel", "Expense" },
                { "utilities", "Utilities", "Expense" }
            });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "Categories");
    }
}
