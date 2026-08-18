using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CreateAiCaptureFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "image_assets",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    container_id = table.Column<Guid>(type: "uuid", nullable: true),
                    object_path = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    content_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    size_bytes = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_image_assets", x => x.id);
                    table.UniqueConstraint("ix_image_assets_workspace_id_id", x => new { x.workspace_id, x.id });
                    table.CheckConstraint("CK_image_assets_size_positive", "size_bytes > 0");
                    table.CheckConstraint("CK_image_assets_status_valid", "status IN ('PENDING', 'READY', 'FAILED')");
                    table.ForeignKey(
                        name: "FK_image_assets_containers_workspace_id_container_id",
                        columns: x => new { x.workspace_id, x.container_id },
                        principalTable: "containers",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "inventory_captures",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    container_id = table.Column<Guid>(type: "uuid", nullable: false),
                    image_asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_captures", x => x.id);
                    table.UniqueConstraint("ix_inventory_captures_workspace_id_id", x => new { x.workspace_id, x.id });
                    table.CheckConstraint("CK_inventory_captures_status_valid", "status IN ('UPLOADED', 'QUEUED', 'PROCESSING', 'REVIEW_REQUIRED', 'CONFIRMED', 'FAILED')");
                    table.ForeignKey(
                        name: "FK_inventory_captures_containers_workspace_id_container_id",
                        columns: x => new { x.workspace_id, x.container_id },
                        principalTable: "containers",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_captures_image_assets_workspace_id_image_asset_id",
                        columns: x => new { x.workspace_id, x.image_asset_id },
                        principalTable: "image_assets",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ai_processing_jobs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    capture_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    last_error = table.Column<string>(type: "text", nullable: true),
                    input_metadata = table.Column<string>(type: "jsonb", nullable: true),
                    output_metadata = table.Column<string>(type: "jsonb", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_processing_jobs", x => x.id);
                    table.CheckConstraint("CK_ai_processing_jobs_attempt_nonnegative", "attempt_count >= 0");
                    table.CheckConstraint("CK_ai_processing_jobs_status_valid", "status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')");
                    table.ForeignKey(
                        name: "FK_ai_processing_jobs_inventory_captures_workspace_id_capture_id",
                        columns: x => new { x.workspace_id, x.capture_id },
                        principalTable: "inventory_captures",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "detection_suggestions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    capture_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    quantity = table.Column<int>(type: "integer", nullable: false),
                    confidence = table.Column<decimal>(type: "numeric(5,4)", nullable: true),
                    is_removed = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_detection_suggestions", x => x.id);
                    table.CheckConstraint("CK_detection_suggestions_confidence_range", "confidence IS NULL OR (confidence >= 0.0 AND confidence <= 1.0)");
                    table.CheckConstraint("CK_detection_suggestions_quantity_positive", "quantity >= 1");
                    table.ForeignKey(
                        name: "FK_detection_suggestions_inventory_captures_workspace_id_capture_id",
                        columns: x => new { x.workspace_id, x.capture_id },
                        principalTable: "inventory_captures",
                        principalColumns: new[] { "workspace_id", "id" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_inventory_captures_workspace_image",
                table: "inventory_captures",
                columns: new[] { "workspace_id", "image_asset_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ai_processing_jobs_workspace_id_capture_id",
                table: "ai_processing_jobs",
                columns: new[] { "workspace_id", "capture_id" });

            migrationBuilder.CreateIndex(
                name: "IX_detection_suggestions_workspace_id_capture_id",
                table: "detection_suggestions",
                columns: new[] { "workspace_id", "capture_id" });

            migrationBuilder.CreateIndex(
                name: "IX_image_assets_workspace_id_container_id",
                table: "image_assets",
                columns: new[] { "workspace_id", "container_id" });

            migrationBuilder.CreateIndex(
                name: "IX_inventory_captures_workspace_id_container_id",
                table: "inventory_captures",
                columns: new[] { "workspace_id", "container_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_processing_jobs");

            migrationBuilder.DropTable(
                name: "detection_suggestions");

            migrationBuilder.DropTable(
                name: "inventory_captures");

            migrationBuilder.DropTable(
                name: "image_assets");
        }
    }
}
