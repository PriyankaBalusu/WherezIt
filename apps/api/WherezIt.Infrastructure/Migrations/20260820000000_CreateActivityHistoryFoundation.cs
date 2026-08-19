using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CreateActivityHistoryFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "activity_histories",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    activity_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    container_id = table.Column<Guid>(type: "uuid", nullable: false),
                    previous_storage_node_id = table.Column<Guid>(type: "uuid", nullable: true),
                    destination_storage_node_id = table.Column<Guid>(type: "uuid", nullable: true),
                    previous_location_display = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    destination_location_display = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_activity_histories", x => x.id);
                    table.CheckConstraint("ck_activity_histories_activity_type", "activity_type = 'CONTAINER_MOVED'");
                    table.ForeignKey(
                        name: "fk_activity_histories_containers_workspace_id_container_id",
                        columns: x => new { x.workspace_id, x.container_id },
                        principalTable: "containers",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_activity_histories_storage_nodes_workspace_id_destination_storage_node_id",
                        columns: x => new { x.workspace_id, x.destination_storage_node_id },
                        principalTable: "storage_nodes",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_activity_histories_storage_nodes_workspace_id_previous_storage_node_id",
                        columns: x => new { x.workspace_id, x.previous_storage_node_id },
                        principalTable: "storage_nodes",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "fk_activity_histories_workspaces_workspace_id",
                        column: x => x.workspace_id,
                        principalTable: "workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_activity_histories_workspace_container_occurred",
                table: "activity_histories",
                columns: new[] { "workspace_id", "container_id", "occurred_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "activity_histories");
        }
    }
}
