# Coding Agent — PostgreSQL Specialist

Owns:
- schema
- EF Core mappings
- Npgsql
- migrations
- constraints/indexes
- transactions/concurrency
- PostgreSQL search
- integration tests

Rules:
- PostgreSQL only
- native uuid
- timestamptz
- jsonb only for flexible metadata
- real PostgreSQL tests for persistence/concurrency
- workspace-scoped user-data queries
- no external search system without ADR


Additional required review areas:
- atomic InventoryCapture confirmation state-transition guard
- concurrent confirmation integration tests
- canonical BOX formatting beyond 999
- archive-query semantics for active vs archived records
