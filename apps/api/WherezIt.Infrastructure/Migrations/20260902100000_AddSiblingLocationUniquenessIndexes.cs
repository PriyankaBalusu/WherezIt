using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddSiblingLocationUniquenessIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                CREATE UNIQUE INDEX IF NOT EXISTS ix_storage_nodes_workspace_parent_lower_name
                ON storage_nodes (workspace_id, parent_id, LOWER(TRIM(name)))
                WHERE parent_id IS NOT NULL;

                CREATE UNIQUE INDEX IF NOT EXISTS ix_storage_nodes_workspace_root_lower_name
                ON storage_nodes (workspace_id, LOWER(TRIM(name)))
                WHERE parent_id IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DROP INDEX IF EXISTS ix_storage_nodes_workspace_parent_lower_name;
                DROP INDEX IF EXISTS ix_storage_nodes_workspace_root_lower_name;
            ");
        }
    }
}
