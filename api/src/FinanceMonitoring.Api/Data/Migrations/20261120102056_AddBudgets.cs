using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceMonitoring.Api.Data.Migrations;

/// <inheritdoc />
public partial class _20261120102056_AddBudgets : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "Budgets",
            columns: table => new
            {
                Id = table.Column<Guid>(type: "TEXT", nullable: false),
                CategoryId = table.Column<string>(type: "TEXT", nullable: false),
                EffectiveFrom = table.Column<DateOnly>(type: "TEXT", nullable: false),
                Amount = table.Column<long>(type: "INTEGER", nullable: true),
                Currency = table.Column<string>(type: "TEXT", fixedLength: true, maxLength: 3, nullable: false),
                Version = table.Column<long>(type: "INTEGER", nullable: false),
                CreatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTimeOffset>(type: "TEXT", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_Budgets", x => x.Id);
                table.CheckConstraint("CK_Budgets_Amount_PositiveOrCleared", "\"Amount\" IS NULL OR \"Amount\" > 0");
                table.CheckConstraint("CK_Budgets_EffectiveFrom_FirstOfMonth", "substr(\"EffectiveFrom\", 9, 2) = '01'");
                table.ForeignKey(
                    name: "FK_Budgets_Categories_CategoryId",
                    column: x => x.CategoryId,
                    principalTable: "Categories",
                    principalColumn: "Id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_Budgets_CategoryId_EffectiveFrom",
            table: "Budgets",
            columns: new[] { "CategoryId", "EffectiveFrom" },
            unique: true);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(
            name: "Budgets");
    }
}
