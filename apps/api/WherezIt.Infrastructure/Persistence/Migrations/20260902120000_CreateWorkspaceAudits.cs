using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Persistence.Migrations
{
    public partial class CreateWorkspaceAudits : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "workspace_audits",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    inventory_namespace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    actor_user_id = table.Column<string>(type: "character varying(128)", maxLength: 128, nullable: false),
                    allowed_user_ids = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    details_json = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workspace_audits", x => x.id);
                    table.CheckConstraint("ck_workspace_audits_event_type", "event_type IN ('WORKSPACE_CREATED', 'WORKSPACE_DELETED')");
                    table.ForeignKey(
                        name: "FK_workspace_audits_inventory_namespaces_inventory_namespace~",
                        column: x => x.inventory_namespace_id,
                        principalTable: "inventory_namespaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_workspace_audits_namespace_occurred",
                table: "workspace_audits",
                columns: new[] { "inventory_namespace_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "ix_workspace_audits_workspace_occurred",
                table: "workspace_audits",
                columns: new[] { "workspace_id", "occurred_at" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "workspace_audits");
        }
    }
}
