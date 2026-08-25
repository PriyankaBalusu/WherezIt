using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddItemImagesSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "item_id",
                table: "image_assets",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddUniqueConstraint(
                name: "ix_items_workspace_id_id",
                table: "items",
                columns: new[] { "workspace_id", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_image_assets_workspace_id_item_id",
                table: "image_assets",
                columns: new[] { "workspace_id", "item_id" });

            migrationBuilder.AddForeignKey(
                name: "FK_image_assets_items_workspace_id_item_id",
                table: "image_assets",
                columns: new[] { "workspace_id", "item_id" },
                principalTable: "items",
                principalColumns: new[] { "workspace_id", "id" },
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_image_assets_items_workspace_id_item_id",
                table: "image_assets");

            migrationBuilder.DropUniqueConstraint(
                name: "ix_items_workspace_id_id",
                table: "items");

            migrationBuilder.DropIndex(
                name: "IX_image_assets_workspace_id_item_id",
                table: "image_assets");

            migrationBuilder.DropColumn(
                name: "item_id",
                table: "image_assets");
        }
    }
}
