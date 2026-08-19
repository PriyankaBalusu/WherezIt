using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIdentifierRevocation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "is_revoked",
                table: "identifiers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "revoked_at",
                table: "identifiers",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_identifiers_revocation_state",
                table: "identifiers",
                sql: "(is_revoked = false AND revoked_at IS NULL) OR (is_revoked = true AND revoked_at IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_identifiers_revocation_state",
                table: "identifiers");

            migrationBuilder.DropColumn(
                name: "is_revoked",
                table: "identifiers");

            migrationBuilder.DropColumn(
                name: "revoked_at",
                table: "identifiers");
        }
    }
}
