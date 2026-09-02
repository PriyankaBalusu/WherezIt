using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class FixCaptureChildForeignKeys : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ai_processing_jobs DROP CONSTRAINT IF EXISTS FK_ai_processing_jobs_inventory_captures_workspace_id_capture_id;
                ALTER TABLE ai_processing_jobs DROP CONSTRAINT IF EXISTS FK_ai_processing_jobs_inventory_captures_workspace_id_capture_;
                ALTER TABLE ai_processing_jobs DROP CONSTRAINT IF EXISTS ""FK_ai_processing_jobs_inventory_captures_workspace_id_captu~"";

                ALTER TABLE detection_suggestions DROP CONSTRAINT IF EXISTS FK_detection_suggestions_inventory_captures_workspace_id_capture_id;
                ALTER TABLE detection_suggestions DROP CONSTRAINT IF EXISTS FK_detection_suggestions_inventory_captures_workspace_id_captur;
                ALTER TABLE detection_suggestions DROP CONSTRAINT IF EXISTS ""FK_detection_suggestions_inventory_captures_workspace_id_captu~"";

                ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS FK_image_assets_containers_workspace_id_container_id;
                ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS FK_image_assets_items_workspace_id_item_id;

                ALTER TABLE ai_processing_jobs DROP CONSTRAINT IF EXISTS FK_ai_processing_jobs_inventory_captures_capture_id;
                ALTER TABLE ai_processing_jobs ADD CONSTRAINT FK_ai_processing_jobs_inventory_captures_capture_id FOREIGN KEY (capture_id) REFERENCES inventory_captures(id) ON DELETE CASCADE;

                ALTER TABLE detection_suggestions DROP CONSTRAINT IF EXISTS FK_detection_suggestions_inventory_captures_capture_id;
                ALTER TABLE detection_suggestions ADD CONSTRAINT FK_detection_suggestions_inventory_captures_capture_id FOREIGN KEY (capture_id) REFERENCES inventory_captures(id) ON DELETE CASCADE;

                ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS FK_image_assets_containers_container_id;
                ALTER TABLE image_assets ADD CONSTRAINT FK_image_assets_containers_container_id FOREIGN KEY (container_id) REFERENCES containers(id) ON DELETE RESTRICT;

                ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS FK_image_assets_items_item_id;
                ALTER TABLE image_assets ADD CONSTRAINT FK_image_assets_items_item_id FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE ai_processing_jobs DROP CONSTRAINT IF EXISTS FK_ai_processing_jobs_inventory_captures_capture_id;
                ALTER TABLE detection_suggestions DROP CONSTRAINT IF EXISTS FK_detection_suggestions_inventory_captures_capture_id;
                ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS FK_image_assets_containers_container_id;
                ALTER TABLE image_assets DROP CONSTRAINT IF EXISTS FK_image_assets_items_item_id;
            ");
        }
    }
}
