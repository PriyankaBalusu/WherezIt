# ADR-001 — MVP Technology Stack and Architecture

Status: Accepted

## Context

The Personal Storage Memory MVP must be implementable by a small engineering effort while preserving a clear path to production on Google Cloud.

## Decisions

### Frontend

Use React + TypeScript + Vite.

Use:
- React Router
- TanStack Query
- React Hook Form
- Zod

### Backend

Use C# + ASP.NET Core 10.

Architecture: modular monolith.

### Persistence

Use Entity Framework Core with the Npgsql PostgreSQL provider.

### Database

Use PostgreSQL.

Hosted environments use Google Cloud SQL for PostgreSQL.

PostgreSQL replaces all previous MySQL references. There is no dual-database strategy.

### Search

MVP search is PostgreSQL-backed.

Start with exact/prefix/ILIKE techniques and graduate to PostgreSQL full-text search/GIN indexing when needed.

Evaluate `pg_trgm` only if typo tolerance creates clear user value.

Do not introduce Elasticsearch/OpenSearch/vector databases in MVP.

### Authentication

Use Firebase Authentication for identity.

Application authorization and tenant membership are stored/enforced through the application domain in PostgreSQL.

### Hosting

- React: Firebase Hosting
- API: Cloud Run
- PostgreSQL: Cloud SQL
- Images: private Cloud Storage

### AI

Use Vertex AI / Gemini behind `IInventoryVisionProvider`.

AI suggestions require explicit user confirmation.

### Async processing

Use Cloud Tasks for AI capture processing.

## Architecture invariants

- Workspace is tenant boundary.
- BOX ID is permanent.
- QR/barcode identify; they do not authorize.
- Container identification is extensible but MVP implements QR/barcode/simple ID only.
- Core domain does not depend on Google SDKs or EF Core.
- No microservices unless a later ADR approves them.

## Consequences

Benefits:
- strong fit with C# and EF Core
- mature relational/transaction semantics
- native UUID, JSONB, full-text search
- managed Google Cloud deployment
- low infrastructure complexity

Tradeoffs:
- some Google integration code lives in Infrastructure
- Cloud SQL has a baseline managed-service cost
- PWA/browser limitations remain for future NFC/advanced sensor features

## Reconsider when

- actual scale exceeds Cloud SQL/design limits,
- search relevance cannot meet product needs with PostgreSQL,
- a specific subsystem requires independent scaling/release cadence,
- native mobile capabilities become critical to core workflows.
