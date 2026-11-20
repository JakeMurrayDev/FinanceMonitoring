using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FinanceMonitoring.Api.Data.Migrations;

/// <inheritdoc />
public partial class _20261120092336_AddTransactionVersion : Migration
{
    /// <inheritdoc />
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<long>(
            name: "Version",
            table: "Transactions",
            type: "INTEGER",
            nullable: false,
            defaultValue: 1L);
    }

    /// <inheritdoc />
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(
            name: "Version",
            table: "Transactions");
    }
}
