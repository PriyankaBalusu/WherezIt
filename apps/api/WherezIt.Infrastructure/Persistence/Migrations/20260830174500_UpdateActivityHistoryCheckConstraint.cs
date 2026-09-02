using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WherezIt.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UpdateActivityHistoryCheckConstraint : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE activity_histories DROP CONSTRAINT IF EXISTS ck_activity_histories_activity_type;
                ALTER TABLE activity_histories ADD CONSTRAINT ck_activity_histories_activity_type CHECK (activity_type IN ('CONTAINER_CREATED', 'CONTAINER_RENAMED', 'CONTAINER_MOVED', 'TRANSFERRED_OUT', 'TRANSFERRED_IN', 'CONTAINER_PACKED', 'CONTAINER_UNPACKED', 'CONTAINER_ARCHIVED', 'CONTAINER_RESTORED', 'ITEM_ADDED', 'ITEM_UPDATED', 'ITEM_ARCHIVED', 'ITEM_RESTORED', 'ITEM_REMOVED', 'PHOTO_ADDED', 'PHOTO_REMOVED'));
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                ALTER TABLE activity_histories DROP CONSTRAINT IF EXISTS ck_activity_histories_activity_type;
                ALTER TABLE activity_histories ADD CONSTRAINT ck_activity_histories_activity_type CHECK (activity_type IN ('CONTAINER_MOVED', 'TRANSFERRED_OUT', 'TRANSFERRED_IN'));
            ");
        }
    }
}
