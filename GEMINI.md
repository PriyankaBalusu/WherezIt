# GEMINI.md — Wherezit Agent Rules

You are working on the Wherezit MVP.

Read before modifying code:

1. `docs/MVP_SPEC.md`
2. `docs/TICKETS.md`
3. `docs/ADR/*`
4. `README.md`
5. Existing code/tests/configuration relevant to the current ticket

The specification is authoritative. Tickets define implementation order. ADRs lock approved architectural decisions.

## Core product rules

- This is Wherezit, not a QR inventory app.
- A container has an internal UUID and a permanent human-readable ID such as `BOX 010`.
- Moving a container NEVER changes its BOX ID.
- Workspace is the tenant/security boundary.
- QR/barcode identifies a resource; it NEVER authorizes access.
- AI suggestions NEVER become trusted Item rows until explicit user confirmation.
- The user must be able to add, remove, rename, and change quantities during AI review.
- QR, barcode, and no-label workflows use the same Container/Item domain.
- Moving Mode reuses the same domain; do not create a parallel moving inventory model.

## Required stack

Frontend:
- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod

Backend:
- C#
- ASP.NET Core 10
- REST
- modular monolith
- Entity Framework Core
- Npgsql PostgreSQL provider

Database:
- PostgreSQL only
- Google Cloud SQL for PostgreSQL in hosted environments

Google services:
- Firebase Authentication
- Firebase Hosting
- Cloud Run
- Cloud SQL for PostgreSQL
- Cloud Storage
- Vertex AI / Gemini
- Cloud Tasks
- Secret Manager
- Artifact Registry
- Cloud Build
- Cloud Logging
- Cloud Monitoring

## PostgreSQL rules

- PostgreSQL is the only relational database for this project.
- Do not create or retain a parallel MySQL implementation.
- Prefer native `uuid` columns for application identifiers.
- Use `timestamptz` for persisted timestamps unless a documented use case requires otherwise.
- Use `jsonb` only for genuinely flexible structured metadata, not as a substitute for a relational schema.
- Prefer PostgreSQL full-text search for MVP search when simple normalized `ILIKE`/prefix search becomes insufficient.
- Prefer generated/stored `tsvector` or maintained search-vector columns plus GIN indexes when justified.
- If typo tolerance becomes an MVP requirement, evaluate `pg_trgm` before external search infrastructure.
- Do not add Elasticsearch, OpenSearch, Redis search, or a vector database for MVP.
- Every persistence/search query must remain workspace-scoped.
- Use versioned EF Core migrations.
- Integration tests must run against real PostgreSQL (containerized PostgreSQL is acceptable).
- Verify EF Core/Npgsql/.NET package compatibility before installing/upgrading packages.

## Architecture constraints

Do NOT introduce without an explicit approved ticket/ADR:

- microservices
- Kubernetes
- Kafka
- RabbitMQ
- Elasticsearch
- OpenSearch
- Redis
- vector database
- React Native
- native mobile
- NFC
- RFID
- AR
- LiDAR

Prefer the simplest implementation that satisfies acceptance criteria.

Do not create abstractions merely because they may be useful later. Interfaces are appropriate at genuine external boundaries such as AI, object storage, background-task queue, and persistence seams that improve testing.

## Agent execution protocol

For every ticket:

1. Read the ticket and relevant spec/ADR sections.
2. Inspect repository state before proposing changes.
3. Identify dependencies and established conventions.
4. Present a concise implementation plan.
5. Implement the smallest complete vertical slice.
6. Do not silently change architecture.
7. Add/update tests.
8. Run relevant formatter/linter, frontend tests, backend tests, PostgreSQL integration tests, and builds.
9. Fix failures caused by the change.
10. Review the diff for security, tenant isolation, duplication, dead code, secrets, and accidental scope expansion.
11. Update documentation when behavior/config/setup changes.
12. Summarize files changed, behavior, tests/results, acceptance status, and remaining risks.
13. Stop after the ticket unless explicitly told to continue.

## Security rules

- Every resource access must verify workspace membership.
- Never trust client-provided workspace ownership.
- Never expose private Cloud Storage buckets publicly.
- Never embed private inventory/location/user data in QR/barcode payloads.
- Never log auth tokens.
- Use Secret Manager for production secrets.
- Use least-privilege service accounts.
- Validate uploads by size, MIME/signature, and dimensions.
- Rate-limit costly AI endpoints separately from ordinary API endpoints.
- Store only structured model output needed by the product; never hidden model reasoning.

## AI rules

- Vertex AI/Gemini must be accessed behind `IInventoryVisionProvider`.
- Model output must be schema validated.
- AI failure must not corrupt trusted inventory.
- Manual entry must always remain available.
- Confirmation must be idempotent.
- Capture/job processing must tolerate Cloud Task retries.

## Frontend rules

- Mobile-first.
- Accessibility required.
- TanStack Query owns remote/server state.
- React local state owns temporary UI state.
- Avoid giant global stores.
- Provide useful empty/loading/error states.
- Never display AI suggestions as confirmed inventory before explicit confirmation.

## Backend rules

- Modular monolith.
- Domain layer has no Google SDK, HTTP, or EF Core concerns.
- Application layer expresses use cases and authorization-relevant orchestration.
- Infrastructure owns PostgreSQL/EF Core and Google integrations.
- API returns consistent ProblemDetails errors.
- Propagate correlation/trace identifiers.
- Use cancellation tokens for async I/O.

## Completion rule

A ticket is complete only when its acceptance criteria are met and relevant builds/tests pass.


## Two agent hierarchies

Wherezit has two distinct concepts:

### Coding agents
Instructions under `/agents`. These roles build and review the repository.

### Product agents
Defined in `docs/AI_AGENT_ORCHESTRATION.md`:

```text
Wherezit Orchestrator
├── Vision Agent
├── Inventory Agent
└── Retrieval Agent
```

Never confuse coding-agent authority with product-agent runtime permissions.


Also read and preserve `docs/ADR/ADR-003-archive-and-task-security.md`.
