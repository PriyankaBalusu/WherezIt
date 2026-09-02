using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MakeInventoryCaptureTransferFksDeferrable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.Sql("""
        ALTER TABLE detection_suggestions
        ALTER CONSTRAINT "FK_detection_suggestions_inventory_captures_workspace_id_captur"
        DEFERRABLE INITIALLY IMMEDIATE;
        """);

    migrationBuilder.Sql("""
        ALTER TABLE ai_processing_jobs
        ALTER CONSTRAINT "FK_ai_processing_jobs_inventory_captures_workspace_id_capture_i"
        DEFERRABLE INITIALLY IMMEDIATE;
        """);
}

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
{
    migrationBuilder.Sql("""
        ALTER TABLE detection_suggestions
        ALTER CONSTRAINT "FK_detection_suggestions_inventory_captures_workspace_id_captur"
        NOT DEFERRABLE;
        """);

    migrationBuilder.Sql("""
        ALTER TABLE ai_processing_jobs
        ALTER CONSTRAINT "FK_ai_processing_jobs_inventory_captures_workspace_id_capture_i"
        NOT DEFERRABLE;
        """);
}
    }
}
