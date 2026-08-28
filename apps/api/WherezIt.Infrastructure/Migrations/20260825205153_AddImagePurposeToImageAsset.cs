using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddImagePurposeToImageAsset : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "image_purpose",
                table: "image_assets",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "REFERENCE");

            // Explicit historical data backfill
            migrationBuilder.Sql("UPDATE image_assets SET image_purpose = 'ITEM' WHERE item_id IS NOT NULL;");
            migrationBuilder.Sql("UPDATE image_assets SET image_purpose = 'REFERENCE' WHERE container_id IS NOT NULL AND (image_purpose IS NULL OR image_purpose = 'REFERENCE');");

            migrationBuilder.AddCheckConstraint(
                name: "CK_image_assets_purpose_valid",
                table: "image_assets",
                sql: "image_purpose IN ('REFERENCE', 'PHYSICAL_LABEL', 'ITEM')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_image_assets_purpose_valid",
                table: "image_assets");

            migrationBuilder.DropColumn(
                name: "image_purpose",
                table: "image_assets");
        }
    }
}
