using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CreateContainerFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "workspace_box_counters",
                columns: table => new
                {
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    next_box_number = table.Column<int>(type: "integer", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workspace_box_counters", x => x.workspace_id);
                    table.ForeignKey(
                        name: "FK_workspace_box_counters_workspaces_workspace_id",
                        column: x => x.workspace_id,
                        principalTable: "workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "containers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    storage_node_id = table.Column<Guid>(type: "uuid", nullable: false),
                    box_number = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    is_archived = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_containers", x => x.id);
                    table.ForeignKey(
                        name: "FK_containers_storage_nodes_workspace_id_storage_node_id",
                        columns: x => new { x.workspace_id, x.storage_node_id },
                        principalTable: "storage_nodes",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_containers_workspaces_workspace_id",
                        column: x => x.workspace_id,
                        principalTable: "workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_containers_workspace_id_box_number",
                table: "containers",
                columns: new[] { "workspace_id", "box_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_containers_workspace_id_storage_node_id",
                table: "containers",
                columns: new[] { "workspace_id", "storage_node_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "containers");

            migrationBuilder.DropTable(
                name: "workspace_box_counters");
        }
    }
}
