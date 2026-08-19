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

### Persistence-owning ticket contract

Any ticket that introduces or changes persisted application data must explicitly:
- add/update the C# domain/application persistence model as appropriate,
- add/update EF Core configuration in Infrastructure,
- create a version-controlled EF Core migration,
- apply the migration to a clean real PostgreSQL database,
- add/update PostgreSQL-backed integration tests for constraints, tenancy, and relevant concurrency behavior,
- avoid manual table creation in Google Cloud Console,
- keep Cloud SQL, local PostgreSQL, and Testcontainers on the same migration history.

Cloud infrastructure tickets provision the PostgreSQL service/database/connectivity. Domain tickets own application tables and schema evolution.

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


### PLAT-003B — Provision Cloud SQL PostgreSQL dev environment [P0]

Requirements:
- identify/document the Wherezit Google Cloud dev project and region
- provision one cost-conscious Cloud SQL for PostgreSQL dev instance
- PostgreSQL 16 unless a documented compatibility reason requires another supported version
- create `wherezit_dev` database
- create least-privilege application database identity; do not use PostgreSQL superuser at runtime
- store cloud database credentials/secrets outside source control, preferably Secret Manager
- document/configure the secure Cloud Run → Cloud SQL connection strategy
- document EF Core migration execution against Cloud SQL
- apply only migrations that already exist; do not invent domain tables in this infrastructure ticket
- document teardown/cost controls
- no staging/prod database resources yet unless explicitly approved

Acceptance:
- Cloud SQL dev instance and `wherezit_dev` database exist
- actual PostgreSQL connectivity is verified
- no cloud database secret is committed
- migration path is documented and can target Cloud SQL
- Cloud Run connectivity strategy and least-privilege IAM are documented/configured as far as current deployment state allows
- application tables are created only through version-controlled EF Core migrations owned by domain tickets

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
- EF Core entity/configuration and version-controlled migration for `users`
- uniqueness/index constraints required for Firebase UID
- real PostgreSQL integration test for first-sync/idempotency

Acceptance:
- migration applies cleanly to fresh PostgreSQL
- no duplicate users for same Firebase UID

### WS-001 — Create personal workspace [P0]

Requirements:
- PostgreSQL `workspaces` and `workspace_members` tables
- EF Core entities/configuration and version-controlled migration
- workspace ownership/membership constraints and indexes
- initialize workspace-scoped container-number allocator state required for canonical BOX IDs

Acceptance:
- migration applies cleanly to fresh PostgreSQL
- authenticated user creates workspace
- creator becomes OWNER

### WS-UI-001 — Workspace UI Foundation [P0]

**Goal:** Build the authenticated workspace frontend foundation in parallel with
WS-001.

**Dependencies:**
- AUTH-001
- AUTH-002
- AUTH-003

**Parallel With:**
- WS-001

**Owns:**
- Workspace TypeScript models
- Workspace API client
- TanStack Query workspace hooks
- Active workspace UI state
- Workspace loading/error/empty states
- Workspace home/dashboard shell
- Workspace selector for multi-workspace users
- Frontend workspace tests

**Expected API Contract:**
- `GET /api/v1/workspaces`
- Response includes:
  - `id`
  - `name`
  - `role`
  - `createdAt`

**Rules:**
- No EF Core migration
- No DbContext changes
- No backend workspace entity changes
- No Firebase UID supplied by the client for authorization
- No raw Firebase tokens stored or logged
- Backend remains authoritative for workspace authorization
- Coordinate API contract with WS-001 before parallel implementation begins

**Migration Owner:** NO

**Conflict Risk:** LOW

**Definition of Done:**
- Authenticated workspace route exists
- Workspace query/client exists
- Loading, error, and zero-workspace states exist
- Single workspace auto-selects
- Multiple workspaces can be selected
- Workspace home shell renders
- Frontend tests pass
- QA PASS
- Security PASS
- Reviewer APPROVE

### WS-002 — Workspace authorization policy [P0]

Acceptance:
- non-member cannot read/write workspace resources
- PostgreSQL-backed integration tests prove tenant isolation

---

## Storage Hierarchy

### LOC-001 — StorageNode PostgreSQL schema/migration [P0]

Requirements:
- PostgreSQL `storage_nodes` table
- EF Core entity/configuration and version-controlled migration
- recursive parent FK scoped safely to workspace semantics

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

Requirements:
- PostgreSQL `containers` table
- EF Core entity/configuration and version-controlled migration
- permanent internal UUID plus canonical workspace-scoped BOX display fields

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
- activity history persistence is handled by ACT-001

---

## Activity history

### ACT-001 — Activity history persistence [P1]
Requirements:
- persist workspace-scoped activity records for auditable domain changes
- record container moves with container ID, previous location, destination location, actor, and timestamp
- preserve tenant isolation; activity from one workspace must never be readable from another workspace
- use archive/immutable-history semantics rather than normal destructive edits
Acceptance:
- BOX-004 container moves create an activity record once ACT-001 is integrated
- activity records are workspace-scoped and authorization-protected
- rejected/failed moves do not create activity records
- integration tests cover successful move history and cross-workspace isolation

---

## Manual Inventory

### ITEM-001 — Item PostgreSQL schema + CRUD [P0]

Requirements:
- PostgreSQL `items` table
- EF Core entity/configuration and version-controlled migration
- container/workspace relationships, quantity, source, verification/archive fields required by MVP
- PostgreSQL-backed tenant-isolation tests

Acceptance:
- migration applies cleanly to fresh PostgreSQL
- add/edit/archive
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
- PostgreSQL `inventory_captures`, `detection_suggestions`, and `ai_processing_jobs` tables
- EF Core entities/configuration and version-controlled migration
- UUIDs
- `jsonb` only for flexible metadata
- workspace FKs/indexes
- capture confirmation state needed for database-guarded idempotent confirmation

Acceptance:
- migration applies cleanly to fresh PostgreSQL
- constraints/indexes support the review/confirm workflow

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

### ID-001 — Identifier PostgreSQL schema + secure token generation [P0]

Requirements:
- PostgreSQL `identifiers` table
- EF Core entity/configuration and version-controlled migration
- opaque random QR/barcode token stored/resolved without using the token as authorization

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

### UX-003 — Visual Design System & Demo Polish [P1]

**Goal:** Upgrade WherezIt from a functionally complete MVP UI to a polished, modern, cohesive, demo-ready product experience without changing backend/domain behavior.

**Scope:**

- Establish a consistent visual design system for the frontend:
  - typography hierarchy
  - spacing
  - colors
  - surfaces/cards
  - borders/shadows
  - buttons
  - form controls
  - status badges
  - navigation
  - responsive behavior
  - hover/focus/active states

- Redesign the login/authentication experience:
  - use the approved WherezIt logo and branding
  - polished login and account-creation screens
  - communicate the core WherezIt value proposition visually
  - avoid generic Firebase/admin-login styling
  - responsive desktop/mobile presentation

- Improve the application shell:
  - branded header/navigation
  - desktop navigation structure
  - mobile-friendly navigation
  - consistent page layout and spacing

- Polish primary demo/product screens:
  - Workspace Home
  - Workspace Selection
  - Locations
  - Container List
  - Container Detail
  - Item List
  - Search
  - Quick Pack
  - AI Capture Review
  - QR label modal
  - Barcode label modal
  - Scan Resolver
  - Empty/loading/error states

- Make Containers visually easy to understand:
  - prominent canonical BOX ID
  - container name
  - location breadcrumb
  - item count
  - moving destination
  - packed state
  - moving priority
  - useful quick actions

- Improve search presentation so the result clearly answers:
  - what item was found
  - which BOX contains it
  - where that BOX is located

- Make Quick Pack feel like a guided product workflow rather than a raw data-entry form.

- Make AI Review one of the product's flagship screens:
  - clear image/content relationship
  - clear suggested-item review
  - obvious edit/confirm actions
  - maintain explicit human confirmation boundary

- Preserve all UX-001 and UX-002 behavior:
  - loading states
  - empty states
  - safe error states
  - accessibility
  - keyboard support
  - focus management
  - semantic HTML

**Visual Direction:**

- modern
- warm
- premium
- clean
- home-organization focused
- approachable consumer-product feel

Avoid:

- generic Bootstrap/admin-dashboard styling
- plain white forms with little hierarchy
- excessive gradients
- overly playful/gamified styling
- visual changes that reduce accessibility

**Constraints:**

- frontend visual/UI changes only unless a blocking issue is discovered
- no database schema changes
- no EF migrations
- no domain-model changes
- no API contract changes unless separately approved
- no changes to authentication semantics
- no changes to tenant authorization
- no changes to trusted Item boundaries
- no changes to QR/BARCODE security behavior
- no changes to AI confirmation semantics

**Acceptance Criteria:**

- [ ] Login screen uses approved WherezIt branding/logo and has a polished responsive design.
- [ ] Core application screens share a consistent visual language.
- [ ] Workspace Home provides a useful, visually polished overview.
- [ ] Container cards/details prominently show BOX ID and location.
- [ ] Search results clearly communicate item → box → location.
- [ ] Quick Pack feels like a guided workflow.
- [ ] AI Review is visually polished and keeps explicit confirmation.
- [ ] QR/BARCODE modals visually match the rest of the application.
- [ ] Existing loading/empty/error states are visually integrated.
- [ ] Existing accessibility behavior remains intact.
- [ ] Desktop layout is polished.
- [ ] Mobile/responsive layout is usable.
- [ ] Frontend tests pass.
- [ ] Frontend production build passes.
- [ ] No backend/domain/schema changes are introduced.

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

## Database Operations

### DB-DEV-001 — Apply EF Core migrations to Cloud SQL dev [P0]

Problem:
The hosted Cloud SQL development database may not contain the application schema implemented and validated through EF Core migrations.

Goal:
Bring the Cloud SQL development database `wherezit_dev` to the current approved EF Core migration level before deployed integration and E2E testing.

Dependencies:
- all schema-changing MVP tickets required for the current E2E milestone are complete
- current EF Core migration chain has been reviewed
- Cloud SQL target instance/database has been verified
- explicit human approval has been given for the migration command

Requirements:
- target project must be `wherezit-505615`
- target Cloud SQL instance must be `wherezit-db-dev`
- target database must be `wherezit_dev`
- verify current database schema before mutation
- verify existing `__EFMigrationsHistory` state
- verify exact pending EF Core migrations
- apply the approved migration chain exactly once
- do not recreate the database
- do not manually create application tables in Cloud SQL Studio
- do not modify production databases
- do not combine this task with unrelated Cloud Run, Firebase, IAM, or bucket mutations

Execution protocol:

VERIFY
→ IDENTIFY CURRENT SCHEMA STATE
→ REPORT PENDING MIGRATIONS
→ PROPOSE EXACT MIGRATION COMMAND
→ WAIT FOR HUMAN APPROVAL
→ APPLY ONCE
→ VERIFY ONCE
→ STOP

Verification after migration:
- expected application tables exist
- `__EFMigrationsHistory` exists
- migration history matches repository migration chain
- no unexpected tables/schema changes were introduced
- application database user retains required permissions
- Cloud SQL connectivity remains healthy

Acceptance:
- all approved EF migrations through the selected release point are applied successfully
- `__EFMigrationsHistory` contains the expected migration IDs
- expected application tables are present
- no pending migration remains for the selected release point
- no production database was modified
- no unrelated cloud mutation was performed

Safety:
- external database mutation requires explicit human approval
- never retry a failed migration automatically
- never delete/recreate the database because of migration failure
- if migration fails, capture exact error and current migration state, then STOP
- maximum one migration execution attempt per approval

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
