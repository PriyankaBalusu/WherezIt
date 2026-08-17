using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CreateItemFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_containers_workspace_id_id",
                table: "containers",
                columns: new[] { "workspace_id", "id" },
                unique: true);

            migrationBuilder.CreateTable(
                name: "items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    container_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false, defaultValue: 1),
                    source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    is_verified = table.Column<bool>(type: "boolean", nullable: false),
                    is_archived = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_items", x => x.id);
                    table.CheckConstraint("CK_items_quantity_positive", "quantity >= 1");
                    table.CheckConstraint("CK_items_source_valid", "source IN ('MANUAL', 'AI_CONFIRMED')");
                    table.ForeignKey(
                        name: "FK_items_containers_workspace_id_container_id",
                        columns: x => new { x.workspace_id, x.container_id },
                        principalTable: "containers",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_items_workspaces_workspace_id",
                        column: x => x.workspace_id,
                        principalTable: "workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_items_workspace_id_container_id",
                table: "items",
                columns: new[] { "workspace_id", "container_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "items");

            migrationBuilder.DropIndex(
                name: "ix_containers_workspace_id_id",
                table: "containers");
        }
    }
}
