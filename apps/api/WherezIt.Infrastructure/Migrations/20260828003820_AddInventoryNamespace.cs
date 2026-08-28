using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryNamespace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Drop existing workspace-scoped unique constraints and FKs
            migrationBuilder.DropForeignKey(
                name: "fk_activity_histories_containers_workspace_id_container_id",
                table: "activity_histories");

            migrationBuilder.DropForeignKey(
                name: "FK_containers_workspaces_workspace_id",
                table: "containers");

            migrationBuilder.DropIndex(
                name: "ix_containers_workspace_id_box_number",
                table: "containers");

            migrationBuilder.DropCheckConstraint(
                name: "ck_activity_histories_activity_type",
                table: "activity_histories");

            // 2. Add nullable inventory_namespace_id columns temporarily for data backfill
            migrationBuilder.AddColumn<Guid>(
                name: "inventory_namespace_id",
                table: "workspaces",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "inventory_namespace_id",
                table: "containers",
                type: "uuid",
                nullable: true);

            // 3. Create new tables
            migrationBuilder.CreateTable(
                name: "inventory_namespaces",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_namespaces", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "inventory_namespace_box_counters",
                columns: table => new
                {
                    inventory_namespace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    next_box_number = table.Column<int>(type: "integer", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_namespace_box_counters", x => x.inventory_namespace_id);
                    table.ForeignKey(
                        name: "FK_inventory_namespace_box_counters_inventory_namespaces_inven~",
                        column: x => x.inventory_namespace_id,
                        principalTable: "inventory_namespaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "inventory_namespace_members",
                columns: table => new
                {
                    inventory_namespace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_namespace_members", x => new { x.inventory_namespace_id, x.user_id });
                    table.ForeignKey(
                        name: "FK_inventory_namespace_members_inventory_namespaces_inventory_~",
                        column: x => x.inventory_namespace_id,
                        principalTable: "inventory_namespaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_inventory_namespace_members_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            // 4. Data Migration: Group existing workspaces by OWNER and initialize namespaces
            migrationBuilder.Sql(@"
                DO $$
                DECLARE
                    orphan_ws RECORD;
                    sole_owner_user RECORD;
                    multi_owner_ws RECORD;
                    co_owner RECORD;
                    new_ns_id UUID;
                    dup_row RECORD;
                    next_box INT;
                BEGIN
                    -- Create temp table to track owner counts per workspace
                    CREATE TEMP TABLE ws_owner_counts AS
                    SELECT workspace_id, COUNT(*) as owner_count
                    FROM workspace_members
                    WHERE role = 'OWNER'
                    GROUP BY workspace_id;

                    -- Create temp table to classify all workspaces
                    CREATE TEMP TABLE ws_owners AS
                    SELECT w.id as workspace_id, COALESCE(oc.owner_count, 0) as owner_count
                    FROM workspaces w
                    LEFT JOIN ws_owner_counts oc ON w.id = oc.workspace_id;

                    -- Create temp table to hold final namespace assignments
                    CREATE TEMP TABLE ws_namespace_assignments (
                        workspace_id UUID PRIMARY KEY,
                        namespace_id UUID
                    );

                    -- Case 1: Zero-owner workspaces (each gets its OWN InventoryNamespace)
                    FOR orphan_ws IN 
                        SELECT workspace_id FROM ws_owners WHERE owner_count = 0
                    LOOP
                        new_ns_id := gen_random_uuid();
                        INSERT INTO inventory_namespaces (id, name, created_at, updated_at)
                        VALUES (new_ns_id, 'My Inventory', NOW(), NOW());
                        
                        INSERT INTO ws_namespace_assignments (workspace_id, namespace_id)
                        VALUES (orphan_ws.workspace_id, new_ns_id);
                    END LOOP;

                    -- Case 2: One-owner workspaces (group workspaces by sole owner)
                    FOR sole_owner_user IN
                        SELECT DISTINCT wm.user_id
                        FROM workspace_members wm
                        JOIN ws_owners o ON wm.workspace_id = o.workspace_id
                        WHERE wm.role = 'OWNER' AND o.owner_count = 1
                    LOOP
                        new_ns_id := gen_random_uuid();
                        INSERT INTO inventory_namespaces (id, name, created_at, updated_at)
                        VALUES (new_ns_id, 'My Inventory', NOW(), NOW());
                        
                        INSERT INTO inventory_namespace_members (inventory_namespace_id, user_id, role, created_at)
                        VALUES (new_ns_id, sole_owner_user.user_id, 'OWNER', NOW());
                        
                        INSERT INTO ws_namespace_assignments (workspace_id, namespace_id)
                        SELECT wm.workspace_id, new_ns_id
                        FROM workspace_members wm
                        JOIN ws_owners o ON wm.workspace_id = o.workspace_id
                        WHERE wm.role = 'OWNER' 
                          AND o.owner_count = 1 
                          AND wm.user_id = sole_owner_user.user_id;
                    END LOOP;

                    -- Case 3: Multiple-owner workspaces (each workspace gets its own namespace, co-owners added to it)
                    FOR multi_owner_ws IN
                        SELECT workspace_id FROM ws_owners WHERE owner_count > 1
                    LOOP
                        new_ns_id := gen_random_uuid();
                        INSERT INTO inventory_namespaces (id, name, created_at, updated_at)
                        VALUES (new_ns_id, 'My Inventory', NOW(), NOW());
                        
                        FOR co_owner IN
                            SELECT user_id 
                            FROM workspace_members 
                            WHERE workspace_id = multi_owner_ws.workspace_id AND role = 'OWNER'
                        LOOP
                            INSERT INTO inventory_namespace_members (inventory_namespace_id, user_id, role, created_at)
                            VALUES (new_ns_id, co_owner.user_id, 'OWNER', NOW())
                            ON CONFLICT (inventory_namespace_id, user_id) DO NOTHING;
                        END LOOP;
                        
                        INSERT INTO ws_namespace_assignments (workspace_id, namespace_id)
                        VALUES (multi_owner_ws.workspace_id, new_ns_id);
                    END LOOP;

                    -- Apply namespace assignments to workspaces table
                    UPDATE workspaces w
                    SET inventory_namespace_id = a.namespace_id
                    FROM ws_namespace_assignments a
                    WHERE w.id = a.workspace_id;

                    -- Backfill containers with their workspace's namespace
                    UPDATE containers c
                    SET inventory_namespace_id = w.inventory_namespace_id
                    FROM workspaces w
                    WHERE c.workspace_id = w.id;

                    -- Normalize duplicate box numbers within each namespace
                    FOR dup_row IN
                        SELECT c1.id, c1.inventory_namespace_id
                        FROM containers c1
                        WHERE EXISTS (
                            SELECT 1 FROM containers c2
                            WHERE c2.inventory_namespace_id = c1.inventory_namespace_id
                              AND c2.box_number = c1.box_number
                              AND (c2.created_at < c1.created_at OR (c2.created_at = c1.created_at AND c2.id < c1.id))
                        )
                        ORDER BY c1.created_at ASC, c1.id ASC
                    LOOP
                        SELECT COALESCE(MAX(box_number), 0) + 1 INTO next_box
                        FROM containers
                        WHERE inventory_namespace_id = dup_row.inventory_namespace_id;

                        UPDATE containers
                        SET box_number = next_box
                        WHERE id = dup_row.id;
                    END LOOP;

                    -- Initialize counters using explicit non-shadowed aliasing
                    INSERT INTO inventory_namespace_box_counters (inventory_namespace_id, next_box_number)
                    SELECT
                        ns.id,
                        COALESCE(MAX(c.box_number), 0) + 1
                    FROM inventory_namespaces ns
                    LEFT JOIN containers c ON c.inventory_namespace_id = ns.id
                    GROUP BY ns.id;

                    -- Clean up temp tables
                    DROP TABLE ws_owner_counts;
                    DROP TABLE ws_owners;
                    DROP TABLE ws_namespace_assignments;

                END $$;
            ");

            // 5. Make columns non-nullable after successful data backfill
            migrationBuilder.AlterColumn<Guid>(
                name: "inventory_namespace_id",
                table: "workspaces",
                type: "uuid",
                nullable: false);

            migrationBuilder.AlterColumn<Guid>(
                name: "inventory_namespace_id",
                table: "containers",
                type: "uuid",
                nullable: false);

            // 6. Tighten alternate keys, indexes, and constraints
            migrationBuilder.AddUniqueConstraint(
                name: "ak_workspaces_inventory_namespace_id_id",
                table: "workspaces",
                columns: new[] { "inventory_namespace_id", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_workspaces_inventory_namespace_id",
                table: "workspaces",
                column: "inventory_namespace_id");

            migrationBuilder.CreateIndex(
                name: "ix_containers_inventory_namespace_id_box_number",
                table: "containers",
                columns: new[] { "inventory_namespace_id", "box_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_containers_inventory_namespace_id_workspace_id",
                table: "containers",
                columns: new[] { "inventory_namespace_id", "workspace_id" });

            migrationBuilder.CreateIndex(
                name: "IX_activity_histories_container_id",
                table: "activity_histories",
                column: "container_id");

            migrationBuilder.AddCheckConstraint(
                name: "ck_activity_histories_activity_type",
                table: "activity_histories",
                sql: "activity_type IN ('CONTAINER_MOVED', 'TRANSFERRED_OUT', 'TRANSFERRED_IN')");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_namespace_members_user_id",
                table: "inventory_namespace_members",
                column: "user_id");

            migrationBuilder.AddForeignKey(
                name: "FK_activity_histories_containers_container_id",
                table: "activity_histories",
                column: "container_id",
                principalTable: "containers",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_containers_inventory_namespaces_inventory_namespace_id",
                table: "containers",
                column: "inventory_namespace_id",
                principalTable: "inventory_namespaces",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_containers_workspaces_inventory_namespace_id_workspace_id",
                table: "containers",
                columns: new[] { "inventory_namespace_id", "workspace_id" },
                principalTable: "workspaces",
                principalColumns: new[] { "inventory_namespace_id", "id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_workspaces_inventory_namespaces_inventory_namespace_id",
                table: "workspaces",
                column: "inventory_namespace_id",
                principalTable: "inventory_namespaces",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            // 7. Drop retired workspace counter
            migrationBuilder.DropTable(
                name: "workspace_box_counters");

            // 8. Alter composite workspace-bound FKs to be DEFERRABLE
            migrationBuilder.Sql("ALTER TABLE items ALTER CONSTRAINT \"FK_items_containers_workspace_id_container_id\" DEFERRABLE INITIALLY DEFERRED;");
            migrationBuilder.Sql("ALTER TABLE identifiers ALTER CONSTRAINT \"fk_identifiers_containers_workspace_id_container_id\" DEFERRABLE INITIALLY DEFERRED;");
            migrationBuilder.Sql("ALTER TABLE image_assets ALTER CONSTRAINT \"FK_image_assets_containers_workspace_id_container_id\" DEFERRABLE INITIALLY DEFERRED;");
            migrationBuilder.Sql("ALTER TABLE image_assets ALTER CONSTRAINT \"FK_image_assets_items_workspace_id_item_id\" DEFERRABLE INITIALLY DEFERRED;");
            migrationBuilder.Sql("ALTER TABLE inventory_captures ALTER CONSTRAINT \"FK_inventory_captures_containers_workspace_id_container_id\" DEFERRABLE INITIALLY DEFERRED;");
            migrationBuilder.Sql("ALTER TABLE inventory_captures ALTER CONSTRAINT \"FK_inventory_captures_image_assets_workspace_id_image_asset_id\" DEFERRABLE INITIALLY DEFERRED;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Best effort down migration
            migrationBuilder.Sql("ALTER TABLE items ALTER CONSTRAINT \"FK_items_containers_workspace_id_container_id\" NOT DEFERRABLE;");
            migrationBuilder.Sql("ALTER TABLE identifiers ALTER CONSTRAINT \"fk_identifiers_containers_workspace_id_container_id\" NOT DEFERRABLE;");
            migrationBuilder.Sql("ALTER TABLE image_assets ALTER CONSTRAINT \"FK_image_assets_containers_workspace_id_container_id\" NOT DEFERRABLE;");
            migrationBuilder.Sql("ALTER TABLE image_assets ALTER CONSTRAINT \"FK_image_assets_items_workspace_id_item_id\" NOT DEFERRABLE;");
            migrationBuilder.Sql("ALTER TABLE inventory_captures ALTER CONSTRAINT \"FK_inventory_captures_containers_workspace_id_container_id\" NOT DEFERRABLE;");
            migrationBuilder.Sql("ALTER TABLE inventory_captures ALTER CONSTRAINT \"FK_inventory_captures_image_assets_workspace_id_image_asset_id\" NOT DEFERRABLE;");

            migrationBuilder.CreateTable(
                name: "workspace_box_counters",
                columns: table => new
                {
                    workspace_id = table.Column<Guid>(type: "uuid", nullable: false),
                    next_box_number = table.Column<int>(type: "integer", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workspace_box_counters", x => x.workspace_id);
                    table.ForeignKey(
                        name: "FK_workspace_box_counters_workspaces_workspace_id",
                        column: x => x.workspace_id,
                        principalTable: "workspaces",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.DropForeignKey(
                name: "FK_activity_histories_containers_container_id",
                table: "activity_histories");

            migrationBuilder.DropForeignKey(
                name: "FK_containers_inventory_namespaces_inventory_namespace_id",
                table: "containers");

            migrationBuilder.DropForeignKey(
                name: "FK_containers_workspaces_inventory_namespace_id_workspace_id",
                table: "containers");

            migrationBuilder.DropForeignKey(
                name: "FK_workspaces_inventory_namespaces_inventory_namespace_id",
                table: "workspaces");

            migrationBuilder.DropTable(
                name: "inventory_namespace_box_counters");

            migrationBuilder.DropTable(
                name: "inventory_namespace_members");

            migrationBuilder.DropTable(
                name: "inventory_namespaces");

            migrationBuilder.DropUniqueConstraint(
                name: "ak_workspaces_inventory_namespace_id_id",
                table: "workspaces");

            migrationBuilder.DropIndex(
                name: "ix_workspaces_inventory_namespace_id",
                table: "workspaces");

            migrationBuilder.DropIndex(
                name: "ix_containers_inventory_namespace_id_box_number",
                table: "containers");

            migrationBuilder.DropIndex(
                name: "IX_containers_inventory_namespace_id_workspace_id",
                table: "containers");

            migrationBuilder.DropIndex(
                name: "IX_activity_histories_container_id",
                table: "activity_histories");

            migrationBuilder.DropCheckConstraint(
                name: "ck_activity_histories_activity_type",
                table: "activity_histories");

            migrationBuilder.DropColumn(
                name: "inventory_namespace_id",
                table: "workspaces");

            migrationBuilder.DropColumn(
                name: "inventory_namespace_id",
                table: "containers");

            migrationBuilder.CreateIndex(
                name: "ix_containers_workspace_id_box_number",
                table: "containers",
                columns: new[] { "workspace_id", "box_number" },
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_activity_histories_activity_type",
                table: "activity_histories",
                sql: "activity_type = 'CONTAINER_MOVED'");

            migrationBuilder.AddForeignKey(
                name: "fk_activity_histories_containers_workspace_id_container_id",
                table: "activity_histories",
                columns: new[] { "workspace_id", "container_id" },
                principalTable: "containers",
                principalColumns: new[] { "workspace_id", "id" },
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_containers_workspaces_workspace_id",
                table: "containers",
                column: "workspace_id",
                principalTable: "workspaces",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
