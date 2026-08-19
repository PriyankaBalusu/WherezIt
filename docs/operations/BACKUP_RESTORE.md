# WherezIt Operational Runbook: Backup & Recovery

## 1. Overview & System Boundaries

WherezIt persistence is divided into three distinct operational storage tiers:

1. **Relational Database (Cloud SQL for PostgreSQL)**: Application state (Workspaces, StorageNodes, Containers, Items, Identifiers, ActivityHistories).
2. **Binary Object Storage (Google Cloud Storage)**: Private uploaded container image assets (`gs://wherezit-private-images-...`).
3. **Identity & Authentication (Firebase Authentication)**: Managed end-user credentials and Firebase UIDs.

> [!IMPORTANT]
> **Recovery Boundary Notice**: A Cloud SQL database backup or Point-In-Time Recovery (PITR) restores only the PostgreSQL database. It does **not** restore GCS binary objects or Firebase Auth user accounts. System recovery requires validating all three tiers.

---

## 2. Cloud SQL for PostgreSQL Backup & PITR

### Configuration (EXPECTED / TO VERIFY ON HOSTED GCP)

- **Target Instance**: `wherezit-pg-dev` / Database: `wherezit-dev`
- **Automated Daily Backup Window**: 03:00 UTC
- **Backup Retention**: 7 days
- **Point-In-Time Recovery (PITR)**: Enabled (Write-Ahead Logging / WAL archiving retained for 7 days)

### Out-of-Place Restore Runbook

Always perform out-of-place restores to a new temporary Cloud SQL instance or database to prevent accidental data corruption.

#### Step 1: Declare Incident & Freeze Writes
- Inform stakeholders and switch Cloud Run API traffic to maintenance status or halt write access if database corruption is actively occurring.

#### Step 2: Identify Target Recovery Point
- Identify the exact timestamp or backup ID prior to data corruption/loss.

#### Step 3: Restore to a Temporary Cloud SQL Instance
```bash
# Example Cloud SQL PITR command to restore to a new instance:
gcloud sql instances clone wherezit-pg-dev wherezit-pg-restore-temp \
  --point-in-time "2026-08-19T14:30:00Z"
```

#### Step 4: Verify Schema & Data Integrity
- Connect to `wherezit-pg-restore-temp` using EF Core CLI or psql:
  ```bash
  # Check current applied migration level matches latest application code:
  dotnet ef database update --connection "Host=...;Database=wherezit_dev;..."
  ```
- Run integration verification test suite against restored database instance.

#### Step 5: Cut Over Connection String
- Update connection string in Secret Manager (`WHEREZIT_DB_CONNECTION_STRING`) or environment configuration:
  ```bash
  gcloud secrets versions add WHEREZIT_DB_CONNECTION_STRING --data-file="connection.txt"
  ```
- Restart Cloud Run service instances to pick up new connection string.

#### Step 6: Post-Restore Cleanup
- Retain the original instance for 72 hours for auditing before deletion.

---

## 3. Google Cloud Storage (GCS) Asset Recovery

### Configuration & Protection (RECOMMENDED)

- **Bucket**: `wherezit-private-images`
- **Access Control**: Uniform Bucket-Level Access (No public access)
- **Soft Delete**: Enabled (7-day retention for soft-deleted objects)
- **Object Versioning**: Recommended for production buckets

### Recovery Procedure
- If an object is deleted accidentally, recover via `gcloud storage`:
  ```bash
  # Restore soft-deleted object:
  gcloud storage restore gs://wherezit-private-images/{workspaceId}/{containerId}/{imageId}.jpg
  ```

---

## 4. Firebase Authentication Boundary

- Firebase Authentication users are stored in Google's managed auth infrastructure.
- In the event of a database restore, verify that `Users` and `WorkspaceMemberships` rows in PostgreSQL align with active Firebase UIDs.
- Use `dotnet run --seed` or administrative user reconciliation scripts if orphaned UIDs require restoration.

---

## 5. Secret Manager & Configuration Recovery

- Secrets (`ConnectionStrings__PostgreSQL`, `Firebase__ProjectId`, `VertexAI__ProjectId`) are managed via GCP Secret Manager.
- Never store plaintext secrets in git repositories or operational runbooks.
- Backup secret configuration references:
  ```bash
  gcloud secrets list --project=wherezit-505615
  ```
