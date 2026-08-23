using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using WherezIt.Infrastructure.Persistence;

#nullable disable

namespace WherezIt.Infrastructure.Migrations
{
    [DbContext(typeof(WherezItDbContext))]
    [Migration("20260818040000_CreateSearchFoundation")]
    public partial class CreateSearchFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "CREATE INDEX IF NOT EXISTS ix_items_name_to_tsvector ON items USING gin (to_tsvector('english', name));");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_items_name_to_tsvector;");
        }
    }
}
