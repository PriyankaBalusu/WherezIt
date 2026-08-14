# Personal Storage Memory — MVP Development Specification

Version: 1.1  
Status: Implementation Source of Truth  
Database decision: PostgreSQL  
Primary developer workflow: Gemini for architecture/review; Antigravity for implementation

---

## 1. Product Summary

Build a mobile-first **Personal Storage Memory** application that helps users remember:

1. what they own,
2. which container contains an item,
3. exactly where that container is physically located.

This is **not a QR-code inventory application**. QR codes, barcodes, human-readable BOX IDs, photographs, AI, search, and future identification technologies are interaction methods over one storage-memory domain.

### Core promise

**Store**

Create container → photograph contents → AI suggests items → user MUST verify → assign location → optionally create QR/barcode label → save.

**Find**

Search for an item → return item → permanent BOX ID → complete physical location path.

Example:

`Christmas lights → BOX 010 → Home → Garage → Rack A → Shelf 2`

### Product directions

- **Personal Storage Memory** — core consumer product and MVP.
- **Moving Mode** — optional acquisition workflow using the same domain.
- **Storage Facility Digital Twin** — future commercial expansion, not MVP.

---

## 2. MVP Success Criteria

A new user can:

1. Register/sign in.
2. Create a personal workspace.
3. Create an arbitrary physical storage hierarchy.
4. Create a container with a permanent human-readable ID such as `BOX 010`.
5. Photograph container contents.
6. Have Gemini identify likely contents.
7. Review the AI result before anything becomes trusted inventory.
8. Add missing items.
9. Remove incorrect suggestions.
10. Rename items.
11. Change quantities.
12. Confirm inventory.
13. Assign the container to a location.
14. Optionally generate a QR or barcode label visibly containing `BOX 010`.
15. Search for an item later.
16. See exact BOX ID and complete physical location.
17. Scan a QR/barcode and open the container only after authentication/authorization.
18. Move a container without changing its permanent BOX ID.

Target: once a location hierarchy exists, a normal box should be catalogable in roughly 30 seconds.

---

## 3. Explicit Non-Goals

Do not add unless a ticket explicitly requires it:

- microservices
- Kubernetes
- Kafka
- RabbitMQ
- Elasticsearch/OpenSearch
- external vector database
- semantic vector search
- native iOS/Android application
- NFC
- RFID
- LiDAR
- AR navigation
- automatic visual container recognition
- full offline synchronization/conflict resolution
- storage-facility B2B features
- complex household role administration
- UPC/EAN product catalog integration
- voice inventory
- automatic AI acceptance

Do not add speculative abstractions for future capabilities.

---

## 4. Required Technology Stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Zod
- Responsive mobile-first UI
- PWA installability

### Backend

- C#
- ASP.NET Core 10
- REST API
- Modular monolith
- Entity Framework Core
- Npgsql provider
- Containerized for Cloud Run

### Database

- **PostgreSQL only**
- Google Cloud SQL for PostgreSQL
- Local/dev/test PostgreSQL via Docker/container when useful
- EF Core migrations
- PostgreSQL-native `uuid`
- PostgreSQL `timestamptz`
- `jsonb` for flexible metadata only where relational columns are inappropriate

### Hosting and cloud

- Firebase Hosting — web frontend
- Firebase Authentication — identity
- Cloud Run — API/worker entrypoints
- Cloud SQL for PostgreSQL — relational data
- Cloud Storage — private images
- Cloud Tasks — async capture processing
- Vertex AI / Gemini — AI inventory recognition
- Secret Manager — secrets
- Artifact Registry — images
- Cloud Build — CI/CD
- Cloud Logging / Monitoring — observability

---

## 5. Architecture

Use a modular monolith with clear boundaries:

- Domain
- Application
- Infrastructure
- API

A single deployable API is preferred during MVP. Background processing may reuse the same codebase with a separately invoked/hosted worker endpoint if required by Cloud Tasks.

Core domain logic must not depend directly on Google SDKs or EF Core.

---

## 6. Core Domain Model

### User

Represents an application user mapped to Firebase UID.

Key fields:
- `id uuid`
- `firebase_uid text unique not null`
- `email text`
- `display_name text`
- `created_at timestamptz`
- `updated_at timestamptz`

### Workspace

Tenant/security boundary.

Key fields:
- `id uuid`
- `name text`
- `created_by_user_id uuid`
- `next_container_number bigint`
- timestamps

### WorkspaceMember

- `workspace_id uuid`
- `user_id uuid`
- `role` (`OWNER`, future `MEMBER`)
- timestamps

Unique: `(workspace_id, user_id)`.

### StorageNode

Arbitrary recursive physical hierarchy.

Examples: Home, Garage, Rack A, Shelf 2, Closet, Storage Unit.

Fields:
- `id uuid`
- `workspace_id uuid`
- `parent_id uuid null`
- `name text`
- `node_type text`
- `sort_order integer`
- `archived_at timestamptz null`
- timestamps

Rules:
- parent must belong to same workspace
- no self/descendant cycles
- tree traversal may never cross workspace

Indexes:
- `(workspace_id, parent_id)`
- `(workspace_id, lower(name))` where useful

### Container

Fields:
- `id uuid`
- `workspace_id uuid`
- `storage_node_id uuid null`
- `display_number bigint`
- `display_id text` such as `BOX 010`
- `name text null`
- `description text null`
- `status text`
- `created_by_user_id uuid`
- timestamps
- `archived_at timestamptz null`

Unique:
- `(workspace_id, display_number)`
- `(workspace_id, display_id)`

Moving a container changes location only; permanent BOX ID never changes.

### Item

Trusted inventory only.

Fields:
- `id uuid`
- `workspace_id uuid`
- `container_id uuid`
- `name text`
- `description text null`
- `quantity numeric/integer as appropriate`
- `category text null`
- `source text` (`MANUAL`, `AI_CONFIRMED`)
- `verified boolean`
- timestamps
- `archived_at timestamptz null`

### ImageAsset

Fields:
- `id uuid`
- `workspace_id uuid`
- `container_id uuid null`
- `item_id uuid null`
- `storage_object_key text`
- `content_type text`
- dimensions/size
- timestamps

Never expose bucket objects publicly.

### InventoryCapture

Represents a photo-based inventory attempt.

Fields:
- `id uuid`
- `workspace_id uuid`
- `container_id uuid`
- `status`
- timestamps

Suggested states:
`CREATED`, `QUEUED`, `PROCESSING`, `REVIEW_REQUIRED`, `CONFIRMED`, `FAILED`.

### DetectionSuggestion

AI output awaiting user review.

Fields:
- `id uuid`
- `workspace_id uuid`
- `capture_id uuid`
- `suggested_name text`
- `suggested_quantity numeric/integer`
- `suggested_category text null`
- `confidence numeric null`
- `resolution_status`
- `resolved_name text null`
- `resolved_quantity numeric null`
- timestamps

### Identifier

Machine-readable or human interaction identifier attached to a Container.

Fields:
- `id uuid`
- `workspace_id uuid`
- `container_id uuid`
- `type` (`QR`, `BARCODE`)
- `token_hash text`
- `display_value text null`
- `revoked_at timestamptz null`
- timestamps

QR/barcode payload must not reveal private inventory, workspace ID, user ID, raw location information, or authorization data.

### AIProcessingJob

Fields:
- `id uuid`
- `workspace_id uuid`
- `capture_id uuid`
- `job_type text`
- `provider text`
- `model text`
- `status text`
- `attempt_count integer`
- `input_metadata jsonb`
- `output_metadata jsonb`
- `started_at timestamptz null`
- `completed_at timestamptz null`
- `error_code text null`
- `created_at timestamptz`

Never store hidden chain-of-thought.

### ActivityHistory

Fields:
- `id uuid`
- `workspace_id uuid`
- `actor_user_id uuid`
- `entity_type text`
- `entity_id uuid`
- `action text`
- `metadata jsonb`
- `created_at timestamptz`

---

## 7. PostgreSQL Persistence Rules

1. Use UUIDs natively, not varchar-encoded GUIDs.
2. Persist timestamps as `timestamptz`.
3. Use foreign keys and uniqueness constraints to enforce invariants where possible.
4. Use transactional allocation for workspace-scoped `BOX 001` numbers.
5. Do not use JSONB for core queryable domain fields.
6. Use JSONB for AI/job/activity metadata that is structurally flexible.
7. Migrations are version-controlled.
8. Integration tests use actual PostgreSQL.
9. Every query that returns user-owned data must be tenant/workspace constrained.
10. Do not depend solely on PostgreSQL Row Level Security for application authorization in MVP; authorization must be explicit in application/API behavior. RLS can be evaluated later as defense in depth.

### Atomic BOX ID allocation

Allocate `Workspace.next_container_number` inside a transaction and lock/update the workspace row atomically. EF Core concurrency/transaction logic must guarantee no duplicate display numbers under concurrent container creation.

---

## 8. Tenant Isolation

Workspace is the security boundary.

Every user-facing read/write must:

1. Authenticate Firebase user.
2. Resolve application User.
3. Verify workspace membership.
4. Verify the target entity belongs to that workspace.
5. Perform the action only after those checks.

Never fetch a container only by container ID and then trust a client-provided workspace ID.

Critical security tests must prove cross-workspace denial.

---

## 9. Authentication Flow

Frontend:
1. Authenticate with Firebase.
2. Obtain Firebase ID token.
3. Send `Authorization: Bearer <token>`.

Backend:
1. Verify Firebase token.
2. Extract Firebase UID.
3. Resolve/create application User.
4. Apply workspace authorization policies.

Firebase authenticates identity.
PostgreSQL application data controls domain authorization.

---

## 10. Physical Identification

Every container has:
- internal UUID
- permanent human-readable BOX ID

Optional machine-readable identifiers:
- QR
- Code 128 barcode

### QR

Visible label:
- `BOX 010`
- QR image
- “Scan to open”

Payload:
- opaque, cryptographically random resolver token or URL containing only that opaque token.

Flow:
token → resolve Identifier → authenticate → authorize workspace → load container.

Possession of a QR is not authorization.

### Barcode

Use Code 128 unless implementation research identifies a compelling reason to change.

### No-label mode

Allowed. User can rely on search, location, and container photo.

---

## 11. AI Inventory Workflow

1. User opens/creates container.
2. User captures one or more photos.
3. Browser obtains authorized private upload flow.
4. API creates InventoryCapture.
5. API queues Cloud Task.
6. Worker calls Vertex AI/Gemini through `IInventoryVisionProvider`.
7. Gemini returns schema-constrained structured suggestions.
8. Suggestions are persisted as DetectionSuggestion rows.
9. Capture becomes `REVIEW_REQUIRED`.
10. UI shows editable suggestions.
11. User can accept, rename, change quantity, remove, and add missing items.
12. User confirms.
13. One backend transaction creates trusted Item rows.
14. Suggestions are marked accepted/modified/rejected.
15. Capture becomes confirmed.

Critical rule:

**AI suggestions must never automatically become trusted Item rows.**

Confirmation must be idempotent.

---

## 12. AI Structured Output

Conceptual contract:

```json
{
  "items": [
    {
      "name": "Christmas string lights",
      "quantity": 2,
      "category": "Holiday decorations",
      "confidence": 0.93
    }
  ]
}
```

Validate output server-side.

AI failure must leave the user able to continue with manual entry.

---

## 13. Search

MVP search remains PostgreSQL-backed.

Search across:
- item name
- item description
- category
- tags
- container name
- BOX ID
- StorageNode names
- confirmed AI-derived metadata only where appropriate

Every result must include:
- item/container
- BOX ID
- complete physical location path
- verification/trust status where relevant

### Initial ranking

1. exact normalized item name
2. prefix match
3. full-text match
4. tag/category
5. container/location metadata

### PostgreSQL implementation guidance

Begin with normalized equality/prefix/`ILIKE` if sufficient.

When needed:
- use PostgreSQL full-text search
- use `to_tsvector` / `websearch_to_tsquery` or similar appropriate functions
- add a GIN index to a maintained/generated search vector
- consider `pg_trgm` only when typo-tolerance provides demonstrable value

Do not add external search infrastructure for MVP.

---

## 14. REST API

Base: `/api/v1`

Use JSON and RFC-style ProblemDetails.

### Workspaces

- `POST /workspaces`
- `GET /workspaces`
- `GET /workspaces/{id}`
- `PATCH /workspaces/{id}`

### Storage nodes

- `POST /workspaces/{workspaceId}/storage-nodes`
- `GET /workspaces/{workspaceId}/storage-nodes`
- `GET /storage-nodes/{id}`
- `PATCH /storage-nodes/{id}`
- `POST /storage-nodes/{id}/move`
- `DELETE /storage-nodes/{id}`

### Containers

- `POST /workspaces/{workspaceId}/containers`
- `GET /containers/{id}`
- `PATCH /containers/{id}`
- `POST /containers/{id}/move`
- `POST /containers/{id}/archive`
- `DELETE /containers/{id}`

### Items

- `POST /containers/{id}/items`
- `GET /containers/{id}/items`
- `PATCH /items/{id}`
- `DELETE /items/{id}`
- `POST /items/{id}/move`

### Images

- `POST /containers/{id}/images/upload-request`
- `POST /containers/{id}/images/complete`
- `GET /images/{id}/access-url`

### Captures

- `POST /containers/{id}/captures`
- `GET /captures/{captureId}`
- `POST /captures/{captureId}/confirm`

### Identifiers

- `POST /containers/{id}/identifiers`
- `POST /identifiers/{id}/revoke`
- `POST /identifiers/resolve`

### Search

- `GET /workspaces/{id}/search?q={query}`

### Activity

- `GET /workspaces/{id}/activity`

---

## 15. Frontend Structure

```text
apps/web/src/
  app/
    router/
    providers/
    layouts/
  features/
    auth/
    onboarding/
    workspaces/
    storage/
    containers/
    inventory/
    capture/
    identification/
    search/
    moving/
  components/
  api/
  hooks/
  utils/
  types/
  pwa/
```

Rules:
- TanStack Query owns server state.
- React local state owns temporary UI state.
- Do not mirror the whole API into a global store.
- API calls live in feature/service boundaries.
- Forms are validated with Zod.
- Mobile-first and accessible.

---

## 16. Required MVP Screens

1. Login
2. Registration
3. Workspace setup
4. Organizing scenario
5. Organization approach
6. Dashboard
7. Storage spaces
8. Space detail
9. Add container
10. Capture photo
11. AI processing
12. AI verification
13. Add missing/manual item
14. Choose location
15. Identifier selection
16. QR label preview
17. Barcode label preview
18. Container detail
19. Edit container
20. Scanner
21. Search
22. Search results
23. Item detail
24. Move container
25. Activity
26. Settings

---

## 17. UX Requirements

Consumer-friendly, not warehouse ERP.

Every container view should answer:
1. What is in it?
2. Which box is it?
3. Where is it?

AI verification must show:
- all detected candidates
- editable name
- editable quantity
- remove action
- add missing item
- clear “Confirm inventory” CTA
- no wording that implies suggestions are confirmed beforehand

Label choices:
- QR
- Barcode
- Simple BOX ID
- No label

---

## 18. Security Requirements

- HTTPS only
- Firebase token verification
- strict tenant isolation
- least-privilege IAM
- private Cloud Storage
- short-lived authorized access URLs
- server-generated object paths
- upload MIME/signature/dimension/size validation
- API rate limiting
- stricter AI quotas
- opaque random resolver tokens
- token hash storage where practical
- identifier revocation
- Secret Manager
- no auth-token logging
- no unnecessary private image-content logging
- no hidden AI reasoning storage
- audit sensitive changes

Critical tests:
- User A cannot access User B workspace/container/image.
- QR token alone never bypasses auth.
- Revoked identifiers fail.
- Invalid token returns 401.
- Authenticated non-member is rejected.
- Cross-workspace moves fail.

---

## 19. PWA Scope

MVP:
- installable
- responsive
- mobile camera workflow
- cached app shell
- graceful offline screen
- optional safe cache of recently viewed non-sensitive data

Not MVP:
- offline write synchronization
- general conflict resolution
- background sync of all inventory

---

## 20. Google Cloud Deployment

Separate environments/projects:
- dev
- staging
- prod

Frontend: Firebase Hosting  
Backend: Cloud Run  
Database: **Cloud SQL for PostgreSQL**  
Images: Cloud Storage  
Async: Cloud Tasks  
AI: Vertex AI/Gemini  
Secrets: Secret Manager  
Registry: Artifact Registry  
CI/CD: Cloud Build  
Observability: Cloud Logging + Cloud Monitoring

---

## 21. Repository Layout

```text
storage-memory/
  GEMINI.md
  GEMINI_MASTER_PROMPT.md
  README.md
  docs/
    MVP_SPEC.md
    TICKETS.md
    ADR/
  prompts/
  apps/
    web/
    api/
  tests/
    Domain.Tests/
    Api.IntegrationTests/
    E2E/
  database/
    migrations/
    seeds/
  infrastructure/
    firebase/
    cloudbuild/
    gcp/
  scripts/
```

---

## 22. Testing

Backend:
- xUnit
- domain unit tests
- API integration tests
- PostgreSQL-backed integration tests (prefer Testcontainers or equivalent real PostgreSQL environment)

Frontend:
- Vitest
- React Testing Library
- Playwright E2E

Critical E2E:

Register → create workspace → create location hierarchy → create BOX → upload photo → process with Gemini → review/correct suggestions → confirm → generate QR/barcode → search item → find exact BOX + location.

Do not chase 100% line coverage. Prioritize domain invariants, security, persistence, and critical flows.

---

## 23. MVP Definition of Done

MVP is Done only when:
- all P0 tickets are complete
- tests pass
- local setup works from README
- dev deployment succeeds
- staging deployment succeeds
- critical E2E passes
- PostgreSQL migrations run cleanly on a fresh database
- tenant isolation tests pass
- AI verification remains mandatory
- QR/barcode auth rule is enforced
- no secrets are committed
- no known P0/P1 security defect remains
- demo data can be loaded
