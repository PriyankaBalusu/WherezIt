# Wherezit — Gemini + Antigravity Agent Pack

This repository context pack is the implementation source of truth for the Wherezit MVP.

## Canonical stack

- Frontend: React + TypeScript + Vite
- Routing: React Router
- Server state: TanStack Query
- Forms: React Hook Form + Zod
- Backend: C# + ASP.NET Core 10
- Architecture: modular monolith
- Persistence: Entity Framework Core
- PostgreSQL provider: Npgsql
- Database: Google Cloud SQL for PostgreSQL
- Authentication: Firebase Authentication
- Backend hosting: Google Cloud Run
- Frontend hosting: Firebase Hosting
- Image storage: Google Cloud Storage
- Async processing: Cloud Tasks
- AI: Vertex AI / Gemini behind an application interface
- Secrets: Secret Manager
- CI/CD: Cloud Build + Artifact Registry
- Observability: Cloud Logging + Cloud Monitoring

## Important product rule

This is **not** a QR-code inventory app.

The application is a Wherezit system: users catalog belongings, connect them to permanent containers and physical locations, and retrieve them later through search, labels, photos, and AI-assisted workflows.

QR codes, barcodes, and future identifiers are interaction mechanisms over the same domain.

## Files

- `GEMINI.md` — repository-level implementation-agent rules.
- `docs/MVP_SPEC.md` — authoritative MVP product + technical specification.
- `docs/TICKETS.md` — engineering backlog and implementation order.
- `docs/ADR/ADR-001-technology-stack.md` — locked architecture decisions.
- `prompts/GEMINI_ARCHITECT_REVIEW_PROMPT.md` — use Gemini as architect/reviewer.
- `prompts/ANTIGRAVITY_IMPLEMENTATION_PROMPT.md` — use Antigravity as implementation agent.
- `prompts/ANTIGRAVITY_TICKET_PROMPT.md` — template for one-ticket-at-a-time execution.
- `prompts/GEMINI_CODE_REVIEW_PROMPT.md` — review completed Antigravity work.
- `GEMINI_MASTER_PROMPT.md` — optional autonomous execution prompt.

## Recommended workflow

1. Put this pack in the repository root.
2. Give Gemini the entire repository or at minimum this pack.
3. Use Gemini first for architecture/spec review.
4. Use Antigravity to implement **one ticket at a time**.
5. After important tickets, ask Gemini to review the diff against `MVP_SPEC.md`, `TICKETS.md`, and ADRs.
6. Commit at ticket boundaries.
7. Never allow an agent to silently replace PostgreSQL, the modular-monolith architecture, tenant isolation, or mandatory AI review.

## PostgreSQL migration note

Older project documents referenced MySQL. Those references are obsolete.

**PostgreSQL is now the only approved relational database.**

Do not preserve parallel MySQL code, schemas, migrations, search logic, Docker services, provider packages, or deployment configuration.


## Wherezit agent orchestration

This pack deliberately contains two separate hierarchies:

1. `/agents` — coding-agent roles that build/review Wherezit.
2. `docs/AI_AGENT_ORCHESTRATION.md` — AI agents that run inside Wherezit.

Recommended start:

**Gemini architecture review → approved spec changes → Antigravity Orchestrator → one ticket at a time → QA/Security/Final Review.**


## Architecture review v2.1

This pack incorporates the accepted Gemini architecture-review recommendations:

- strict StorageNode archive blocking
- Container archive with Items preserved
- database-guarded AI confirmation idempotency
- Retrieval Agent query expansion with PostgreSQL-grounded evidence
- authenticated Cloud Tasks OIDC invocation
- QR post-login return-state preservation
- canonical BOX ID formatting beyond 999
- workspace/container-prefixed Cloud Storage object keys

See `docs/ARCHITECTURE_REVIEW_DECISIONS_2026-08-14.md`.
