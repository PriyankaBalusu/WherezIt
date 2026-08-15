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

Schema delivery rules:
- every persistence-owning domain ticket must include EF Core mapping + version-controlled migration
- apply migrations to real PostgreSQL in tests
- never create application tables manually in Cloud SQL/Google Cloud Console
- keep local, Testcontainers, and Cloud SQL schema aligned through the same migration history
- infrastructure tickets may provision database/service/identity/connectivity but do not invent domain tables

