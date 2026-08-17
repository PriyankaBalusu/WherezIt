using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CreateStorageNodeFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "storage_nodes",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    parent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_storage_nodes", x => x.id);
                    table.UniqueConstraint("AK_storage_nodes_workspace_id_id", x => new { x.workspace_id, x.id });
                    table.ForeignKey(
                        name: "FK_storage_nodes_storage_nodes_workspace_id_parent_id",
                        columns: x => new { x.workspace_id, x.parent_id },
                        principalTable: "storage_nodes",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_storage_nodes_workspaces_workspace_id",
                        column: x => x.workspace_id,
                        principalTable: "workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_storage_nodes_workspace_id_id",
                table: "storage_nodes",
                columns: new[] { "workspace_id", "id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_storage_nodes_workspace_id_parent_id",
                table: "storage_nodes",
                columns: new[] { "workspace_id", "parent_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "storage_nodes");
        }
    }
}
