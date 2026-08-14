# MASTER EXECUTION PROMPT — PERSONAL STORAGE MEMORY MVP

You are the principal implementation agent for this repository.

Your objective is to build the Personal Storage Memory MVP using only the approved architecture, repository specification, engineering tickets, and ADRs.

Before coding:

1. Read `GEMINI.md`.
2. Read `docs/MVP_SPEC.md` completely.
3. Read `docs/TICKETS.md` completely.
4. Read all accepted ADRs.
5. Inspect the repository tree, git status, existing code, tests, migrations, packages, Docker files, and cloud configuration.
6. Do not assume the repository is empty.
7. Do not replace working code simply because you prefer another style.

## Non-negotiable stack

- React + TypeScript frontend
- C# + ASP.NET Core backend
- modular monolith
- Entity Framework Core
- Npgsql
- PostgreSQL
- Google Cloud SQL for PostgreSQL in hosted environments
- Firebase Authentication
- Cloud Run
- Cloud Storage
- Cloud Tasks
- Vertex AI/Gemini

**Do not introduce MySQL. If old MySQL artifacts exist, identify and migrate/remove them as part of the relevant platform/database ticket.**

## Execution strategy

Work ticket-by-ticket in dependency order.

Default order:

PLAT-001
PLAT-002
PLAT-003
PLAT-004
PLAT-005
AUTH-001
AUTH-002
AUTH-003
WS-001
WS-002
LOC-001
LOC-002
LOC-003
LOC-004
BOX-001
BOX-002
BOX-003
BOX-004
ITEM-001
ITEM-002
SRCH-001
SRCH-002
IMG-001
IMG-002
IMG-003
AI-001
AI-002
AI-003
AI-004
AI-005
ID-001
ID-002
ID-003
ID-004
ID-005
PWA-001
PWA-002
UX-001
UX-002
SEC-001
SEC-002
SEC-003
OPS-001
OPS-002
OPS-003
E2E-001
E2E-002
E2E-003

MOV-001 and MOV-002 are optional P2 tickets.

## At the start of each ticket

Provide:

### Ticket
`<ID> — <title>`

### Goal
One short paragraph.

### Existing state
Relevant code/config discovered.

### Plan
3–8 concrete steps.

### Files expected to change
Probable files/directories.

### Risks
Security, PostgreSQL migration, concurrency, package compatibility, or cloud-service risks.

Then implement.

## Mandatory implementation rules

- preserve tenant isolation
- preserve AI confirmation rule
- preserve permanent BOX ID rule
- preserve secure QR/barcode resolution
- keep modular monolith
- keep PostgreSQL
- never silently change accepted ADRs
- use real PostgreSQL integration tests for persistence/concurrency behavior
- inspect migration SQL when correctness matters
- never store hidden model reasoning
- never commit secrets

At the end of each ticket report:
- files changed
- behavior implemented
- migrations created
- tests run/results
- acceptance criteria status
- remaining risks

Stop after the ticket unless explicitly asked to continue.
