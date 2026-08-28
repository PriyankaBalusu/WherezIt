using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BackfillWorkspaceInventoryNamespace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Data repair: backfill inventory_namespace_id on any workspaces that have NULL.
            // This can happen when a workspace was created before the InventoryNamespace feature
            // was introduced. We assign the namespace that the workspace owner already belongs to.
            migrationBuilder.Sql(@"
                UPDATE workspaces w
                SET inventory_namespace_id = (
                    SELECT ns.id
                    FROM inventory_namespaces ns
                    JOIN inventory_namespace_members nm ON nm.inventory_namespace_id = ns.id
                    JOIN workspace_members wm ON wm.user_id = nm.user_id
                    WHERE wm.workspace_id = w.id
                    LIMIT 1
                )
                WHERE w.inventory_namespace_id IS NULL
                  AND EXISTS (
                    SELECT 1
                    FROM workspace_members wm2
                    JOIN inventory_namespace_members nm2 ON nm2.user_id = wm2.user_id
                    WHERE wm2.workspace_id = w.id
                  );
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Not reversible — this is a data repair migration.
        }
    }
}
