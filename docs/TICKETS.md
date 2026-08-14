# Wherezit — Engineering Ticket Backlog

Execute in order unless a dependency requires a small reorder.

Priority:
- P0 = required MVP
- P1 = MVP polish/reliability
- P2 = optional/demo enhancement

For every ticket:
1. inspect existing code,
2. produce a short plan,
3. implement the smallest complete slice,
4. run relevant tests,
5. update docs,
6. stop if acceptance criteria are not satisfied.

---

## Foundation

### PLAT-001 — Bootstrap monorepo [P0]

Requirements:
- repository structure from MVP spec
- React/Vite/TypeScript app
- ASP.NET Core solution
- baseline README
- baseline test projects

Acceptance:
- frontend builds
- backend builds
- tests can run
- no secrets committed

### PLAT-002 — Dockerize API [P0]

Requirements:
- multi-stage Dockerfile
- Cloud Run-compatible port/config
- `/health` endpoint

Acceptance:
- local container starts
- health returns 200

### PLAT-003 — PostgreSQL local/integration environment [P0]

Requirements:
- PostgreSQL Docker/Testcontainers setup
- EF Core + Npgsql packages compatible with selected .NET/EF versions
- environment-safe connection strings
- database health check
- no MySQL dependencies

Acceptance:
- API connects to PostgreSQL
- integration tests can create/use a clean PostgreSQL database
- no MySQL provider/package/config remains

### PLAT-004 — Firebase Hosting dev configuration [P0]

Acceptance:
- SPA deploys to dev Hosting
- API base URL is environment-specific

### PLAT-005 — Cloud Build pipeline [P0]

Requirements:
- frontend build/test
- backend build/test
- PostgreSQL integration tests
- Docker build
- Artifact Registry push
- Cloud Run dev deploy
- Firebase Hosting deploy

Acceptance:
- repeatable documented deployment

---

## Authentication & Tenancy

### AUTH-001 — Firebase web authentication [P0]

Requirements:
- sign up
- login
- logout
- email/password
- Google sign-in if practical without delaying MVP

Acceptance:
- authenticated user reaches app shell
- unauthenticated user is redirected

### AUTH-002 — Verify Firebase token in ASP.NET [P0]

Acceptance:
- missing/invalid/expired token → 401
- valid token resolves Firebase UID

### AUTH-003 — Application user sync [P0]

Requirements:
- PostgreSQL `users` table
- map Firebase UID
- create profile on first authenticated API interaction

Acceptance:
- no duplicate users for same Firebase UID

### WS-001 — Create personal workspace [P0]

Acceptance:
- authenticated user creates workspace
- creator becomes OWNER

### WS-002 — Workspace authorization policy [P0]

Acceptance:
- non-member cannot read/write workspace resources
- PostgreSQL-backed integration tests prove tenant isolation

---

## Storage Hierarchy

### LOC-001 — StorageNode PostgreSQL schema/migration [P0]

Acceptance:
- recursive parent supported
- FK constraints applied
- workspace-scoped indexes created
- migration applies cleanly

### LOC-002 — Storage location CRUD and archive policy [P0]

Acceptance:
- create/edit/list nodes
- archive only empty nodes
- reject archive when active child nodes or containers exist
- no recursive archive cascade
- mobile-first UI


Acceptance:
- create/edit/list/delete empty nodes
- UI works mobile and desktop

### LOC-003 — Move location with cycle prevention [P0]

Acceptance:
- valid move succeeds
- self/descendant cycles rejected
- cross-workspace parent rejected

### LOC-004 — Resolve breadcrumb path [P0]

Acceptance:
- returns `Home -> Garage -> Rack A -> Shelf 2`
- path cannot cross workspace

---

## Containers

### BOX-001 — Container PostgreSQL schema [P0]

Acceptance:
- native UUID PK
- workspace/location FKs
- workspace-scoped uniqueness for display number/ID

### BOX-002 — Atomic BOX ID allocator [P0]

Requirements:
- workspace-scoped sequential numbers
- format `BOX 001`
- PostgreSQL-safe concurrent allocation

Acceptance:
- no duplicates under concurrent creation
- moving does not change ID
- concurrency integration test uses real PostgreSQL

### BOX-003 — Container CRUD and archive policy [P0]

Acceptance:
- create/view/edit/archive
- container may be archived with Items intact
- archived container/items excluded from normal active browse/search
- permanent BOX ID preserved
- hard delete is not a normal MVP user flow
- mobile-first UI


Acceptance:
- create/view/edit/archive/delete
- mobile-first UI

### BOX-004 — Move container [P0]

Acceptance:
- location changes
- BOX ID unchanged
- activity record written
- cross-workspace destination rejected

---

## Manual Inventory

### ITEM-001 — Item CRUD [P0]

Acceptance:
- add/edit/delete
- quantity supported
- source MANUAL
- verified
- tenant scoping enforced

### ITEM-002 — Tags/categories [P1]

---

## Search

### SRCH-001 — Search normalization/indexes [P0]

Requirements:
- normalized exact/prefix matching
- add PostgreSQL indexes needed by measured query plan
- if full-text is used, use PostgreSQL FTS/GIN
- no external search engine

Acceptance:
- migration applies cleanly
- common search queries covered by tests

### SRCH-002 — Workspace search [P0]

Requirements:
- exact
- prefix
- PostgreSQL full-text/application ranking when appropriate
- item/container/location metadata

Acceptance:
- result includes item + BOX ID + full location
- workspace isolation enforced

### SRCH-003 — Optional typo tolerance evaluation [P1]

Evaluate `pg_trgm` only if usability testing shows a real need.

---

## Image Handling

### IMG-001 — Private Cloud Storage integration [P0]

Acceptance:
- bucket not public
- least-privilege service account
- object keys use `workspaces/{workspaceUuid}/containers/{containerUuid}/{imageUuid}.{ext}` convention
- path convention is not treated as authorization


Acceptance:
- bucket not public
- least-privilege service account

### IMG-002 — Authorized upload flow [P0]

Acceptance:
- unauthorized user cannot obtain valid upload for another workspace
- object path generated server-side

### IMG-003 — Client image compression [P1]

Acceptance:
- large images are resized/compressed
- constraints documented and tested

---

## AI Inventory

### AI-001 — Capture/job/suggestion PostgreSQL schema [P0]

Requirements:
- UUIDs
- `jsonb` only for flexible metadata
- workspace FKs/indexes

### AI-002 — Queue capture with Cloud Tasks [P0]

Requirements:
- authenticated Cloud Tasks HTTP delivery using OIDC
- dedicated service account
- least-privilege Cloud Run invocation
- protected worker endpoint/route
- idempotent processing

Acceptance:
- capture API returns 202
- processing is safely retryable
- anonymous invocation of worker path fails
- OIDC audience/identity validation covered


Acceptance:
- capture API returns 202
- processing is idempotent/safely retryable

### AI-003 — Vertex AI Gemini vision provider [P0]

Requirements:
- `IInventoryVisionProvider`
- structured result
- schema validation
- timeout/error handling
- model name in configuration

Acceptance:
- valid result maps to DetectionSuggestion
- invalid result does not create Item

### AI-004 — Mandatory AI review screen [P0]

Requirements:
- rename
- quantity
- delete suggestion
- add missing item
- explicit confirmation

Acceptance:
- cannot finalize AI inventory without review/confirm

### AI-005 — Confirm capture transaction [P0]

Acceptance:
- trusted Item rows created only on confirm
- PostgreSQL transaction performs atomic `REVIEW_REQUIRED -> CONFIRMED` state guard
- zero-row state transition prevents Item creation
- repeated/concurrent confirmation does not duplicate Items
- suggestion resolutions persisted
- concurrency integration test uses real PostgreSQL


Acceptance:
- trusted Item rows created only on confirm
- suggestion resolutions persisted
- repeat confirmation does not duplicate items
- PostgreSQL transaction tested

---

## Identification

### ID-001 — Secure identifier token generation [P0]

Acceptance:
- cryptographically random opaque token
- no raw private inventory/location data
- resolver cannot bypass auth

### ID-002 — QR generation + printable label [P0]

Label:
- BOX ID
- QR
- “Scan to open”

Acceptance:
- printed/scanned code resolves authorized container

### ID-003 — Barcode generation/scanning [P0]

Requirements:
- Code 128 unless verified reason to change
- visible BOX ID

Acceptance:
- barcode resolves same container domain

### ID-004 — Identifier resolver and auth return flow [P0]

Acceptance:
- authenticated member succeeds
- unauthenticated/non-member cannot access inventory
- unauthenticated scan preserves trusted internal resolver route through login
- return flow cannot create an open redirect
- tests included


Acceptance:
- authenticated member succeeds
- unauthenticated/non-member cannot access inventory
- tests included

### ID-005 — Identifier revocation [P1]

---

## PWA / UX

### PWA-001 — Manifest/installability [P0]

### PWA-002 — Camera capture UX [P0]

Acceptance:
- supported mobile browsers can capture
- fallback file upload exists

### UX-001 — Empty/loading/error states [P1]

### UX-002 — Accessibility pass [P1]

---

## Moving Mode

### MOV-001 — Minimal moving metadata [P2]

Fields:
- destination room
- packed/unpacked
- priority

### MOV-002 — Quick-pack demo flow [P2]

Reuse normal photo → AI → review → location workflow.
Do not fork the inventory domain.

---

## Security / Ops

### SEC-001 — Endpoint rate limiting [P0]

Separate AI limits from ordinary API limits.

### SEC-002 — Tenant security integration suite [P0]

Run against PostgreSQL.

### SEC-003 — Upload validation [P0]

### OPS-001 — Logging/monitoring/alerts [P1]

### OPS-002 — PostgreSQL backup/restore documentation [P1]

Include Cloud SQL automated backup/PITR approach appropriate to the selected environment.

### OPS-003 — Demo seed data [P1]

Use PostgreSQL-compatible seed path.

---

## Final E2E

### E2E-001 — Critical Wherezit journey [P0]

Register → workspace → hierarchy → BOX → photo → Gemini suggestions → user correction → confirm → QR/barcode → search → exact location.

### E2E-002 — Cross-tenant security journey [P0]

### E2E-003 — Failure/recovery journey [P1]

- Gemini failure → manual entry possible
- upload failure → retry
- revoked QR → rejected
- database transient failure handled safely where applicable


---

## Agent Orchestration

### AGENT-001 — Orchestrator application boundary [P0]

Requirements:
- `IAgentOrchestrator`
- authenticated workspace context
- typed tool interfaces
- no unrestricted DB access
- safe telemetry/fallback

Acceptance:
- supported intents route correctly
- unauthorized context halts before tool calls
- routing/failure tests pass

### AGENT-002 — Vision Agent orchestration [P0]

Acceptance:
- photo output becomes reviewable `DetectionSuggestion`
- invalid model output fails safely
- no trusted `Item` is auto-created

### AGENT-003 — Inventory Agent normalization [P0]

Acceptance:
- names/categories/quantities can be refined
- uncertainty preserved
- suggestions remain editable
- user confirmation remains required

### AGENT-004 — Retrieval Agent [P0]

Requirements:
- natural-language queries
- authorization-aware search/read tools
- grounded result
- BOX ID + full location path

Acceptance:
- relevant natural-language requests find real records
- no cross-workspace leakage
- no fabricated answer when evidence is absent

### AGENT-005 — Agent evaluation harness [P1]

Acceptance:
- repeatable vision, inventory, retrieval, and security evaluations
- baseline metrics documented

### AGENT-006 — Agent observability [P1]

Acceptance:
- model/provider/tool latency and safe failure metadata visible
- no hidden reasoning/private token logging


### SRCH-004 — Retrieval query-expansion contract [P0]

Requirements:
- structured Gemini query-expansion output
- keywords/categories/related terms
- authorization-aware PostgreSQL search tools
- grounded-answer rule

Acceptance:
- natural-language query can expand to syntactic PostgreSQL search intent
- final response references only returned records
- no fabricated result when evidence is absent
- tenant isolation preserved


### BOX-005 — Canonical BOX formatting [P0]

Requirements:
- system-generated canonical ID from `display_number`
- minimum three-digit formatting
- support values above 999
- no user-defined alternate canonical padding

Acceptance:
- 1 -> BOX 001
- 999 -> BOX 999
- 1000 -> BOX 1000
- parsing/search does not depend on fixed maximum width
