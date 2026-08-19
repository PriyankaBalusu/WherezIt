using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddMovingMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "destination_storage_node_id",
                table: "containers",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_packed",
                table: "containers",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "moving_priority",
                table: "containers",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_containers_moving_priority",
                table: "containers",
                sql: "moving_priority IS NULL OR moving_priority IN ('LOW', 'MEDIUM', 'HIGH')");

            migrationBuilder.CreateIndex(
                name: "ix_containers_workspace_id_destination_storage_node_id",
                table: "containers",
                columns: new[] { "workspace_id", "destination_storage_node_id" });

            migrationBuilder.AddForeignKey(
                name: "fk_containers_storage_nodes_workspace_id_destination_storage_node_id",
                table: "containers",
                columns: new[] { "workspace_id", "destination_storage_node_id" },
                principalTable: "storage_nodes",
                principalColumns: new[] { "workspace_id", "id" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_containers_storage_nodes_workspace_id_destination_storage_node_id",
                table: "containers");

            migrationBuilder.DropIndex(
                name: "ix_containers_workspace_id_destination_storage_node_id",
                table: "containers");

            migrationBuilder.DropCheckConstraint(
                name: "ck_containers_moving_priority",
                table: "containers");

            migrationBuilder.DropColumn(
                name: "destination_storage_node_id",
                table: "containers");

            migrationBuilder.DropColumn(
                name: "is_packed",
                table: "containers");

            migrationBuilder.DropColumn(
                name: "moving_priority",
                table: "containers");
        }
    }
}
