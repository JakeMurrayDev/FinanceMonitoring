using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceMonitoring.Api.Data.Migrations;

/// <inheritdoc />
public partial class _20261120090131_AddTransactions : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Transactions",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                Date = table.Column<DateOnly>(type: "TEXT", nullable: false),
                Description = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                Amount = table.Column<long>(type: "INTEGER", nullable: false),
                Currency = table.Column<string>(type: "TEXT", fixedLength: true, maxLength: 3, nullable: false),
                Type = table.Column<string>(type: "TEXT", maxLength: 16, nullable: false),
                CategoryId = table.Column<string>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Transactions", x => x.Id);
                table.CheckConstraint("CK_Transactions_Amount_Positive", "\"Amount\" > 0");
                table.CheckConstraint("CK_Transactions_Currency_Length", "length(\"Currency\") = 3");
                table.ForeignKey(
                    name: "FK_Transactions_Categories_CategoryId",
                    column: x => x.CategoryId,
                    principalTable: "Categories",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Transactions_CategoryId_Date",
            table: "Transactions",
            columns: new[] { "CategoryId", "Date" });

        migrationBuilder.CreateIndex(
            name: "IX_Transactions_Date",
            table: "Transactions",
            column: "Date");

        migrationBuilder.CreateIndex(
            name: "IX_Transactions_Type_Date",
            table: "Transactions",
            columns: new[] { "Type", "Date" });
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "Transactions");
    }
}
