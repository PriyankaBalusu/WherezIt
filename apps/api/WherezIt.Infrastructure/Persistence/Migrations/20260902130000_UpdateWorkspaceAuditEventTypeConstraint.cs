using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Persistence.Migrations
{
    public partial class UpdateWorkspaceAuditEventTypeConstraint : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_workspace_audits_event_type",
                table: "workspace_audits");

            migrationBuilder.AddCheckConstraint(
                name: "ck_workspace_audits_event_type",
                table: "workspace_audits",
                sql: "event_type IN ('WORKSPACE_CREATED', 'WORKSPACE_DELETED', 'LOCATION_CREATED', 'LOCATION_RENAMED', 'LOCATION_DELETED')");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_workspace_audits_event_type",
                table: "workspace_audits");

            migrationBuilder.AddCheckConstraint(
                name: "ck_workspace_audits_event_type",
                table: "workspace_audits",
                sql: "event_type IN ('WORKSPACE_CREATED', 'WORKSPACE_DELETED')");
        }
    }
}
