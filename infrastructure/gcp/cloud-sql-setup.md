# WherezIt — Google Cloud SQL for PostgreSQL (Dev) Setup Guide

Version: 1.1  
Status: Provisioning Architecture Guide  
Target Project: **WherezIt** (Existing GCP Project)  

---

## 1. Overview

This document defines the Google Cloud SQL setup for WherezIt dev environment (`wherezit-db-dev`).

```text
WherezIt API (Cloud Run)
        ↓
Unix domain socket (/cloudsql/<PROJECT_ID>:<REGION>:wherezit-db-dev)
        ↓
Google Cloud SQL (PostgreSQL 16)
        ↓
EF Core + Npgsql (wherezit_dev DB)
```

---

## 2. Configuration & Resource Summary

| Property | Development Value | Notes |
| :--- | :--- | :--- |
| **GCP Project Name** | `WherezIt` | Must use existing project |
| **Instance Name** | `wherezit-db-dev` | PostgreSQL 16 instance |
| **Database Name** | `wherezit_dev` | Primary application database |
| **Region** | `us-central1` | Low latency, standard region |
| **Tier** | `db-f1-micro` | Shared core, 0.6 GB RAM (Cost-optimized for dev) |
| **Storage** | 10 GB SSD | Auto-increase enabled |
| **Availability** | Single-zone (Zonal) | HA disabled for cost optimization |
| **Admin User** | `wherezit_admin` | Used for EF Core migrations |
| **App User** | `wherezit_app` | Runtime API user (Least privilege) |
| **Runtime Secret** | `wherezit-db-dev-connection-string` | Holds runtime connection string securely |
| **Admin Secret** | `wherezit-db-dev-admin-connection-string` | Holds admin/migration connection string securely |

---

## 3. Pre-Requisites & Project Discovery

1. **Authenticate & Discover Existing Project**:
   ```bash
   gcloud auth login
   gcloud projects list --filter="name~WherezIt"
   ```

2. **Set Active Project**:
   ```bash
   gcloud config set project <EXISTING_WHEREZIT_PROJECT_ID>
   ```

---

## 4. Provisioning Execution

Execute the reproducible provisioning script:

```bash
cd infrastructure/gcp
./provision-cloud-sql.sh <EXISTING_WHEREZIT_PROJECT_ID> [us-central1]
```

### Key Script Safeguards
1. **Fail-Fast Project Check**: Verifies that the GCP project display name matches exactly `"WherezIt"` before executing.
2. **Idempotency**: Skips password rotation and secret overwrites if secrets already exist in Secret Manager.
3. **Pipefail-Safe Password Generation**: Uses `openssl rand -hex 24`.
4. **Credential Separation**: Creates separate admin (`wherezit-db-dev-admin-connection-string`) and application runtime (`wherezit-db-dev-connection-string`) secrets.

---

## 5. Cloud Run → Cloud SQL Connectivity & IAM

Cloud Run connects natively using Cloud SQL Auth Proxy via Unix domain sockets:

- **Socket Path**: `/cloudsql/<PROJECT_ID>:<REGION>:wherezit-db-dev`
- **Npgsql Connection String Pattern**:
  ```text
  Host=/cloudsql/<PROJECT_ID>:<REGION>:wherezit-db-dev;Database=wherezit_dev;Username=wherezit_app;Password=<SECRET>
  ```

### Pending IAM Roles (To be bound in PLAT-005)
During **PLAT-005** (Cloud Run deployment), the Cloud Run service account will receive:
- `roles/cloudsql.client`: Grants authority to connect to Cloud SQL instance.
- `roles/secretmanager.secretAccessor`: Grants authority to read database secrets at runtime.

---

## 6. Least Privilege Database Security (`wherezit_app`)

By default, Cloud SQL grants `cloudsqlsuperuser` to users created via `gcloud sql users create`.
To enforce least privilege for the runtime application user:

```sql
-- Connect as postgres / wherezit_admin
REVOKE cloudsqlsuperuser FROM wherezit_app;
GRANT CONNECT ON DATABASE wherezit_dev TO wherezit_app;
```

---

## 7. Local Administrative Access & EF Core Migrations

To run EF Core migrations locally against Cloud SQL:

1. **Start Cloud SQL Auth Proxy**:
   ```bash
   cloud-sql-proxy <PROJECT_ID>:<REGION>:wherezit-db-dev
   ```

2. **Apply EF Core Migrations**:
   ```bash
   dotnet ef database update \
     --project apps/api/WherezIt.Infrastructure/WherezIt.Infrastructure.csproj \
     --startup-project apps/api/WherezIt.Api/WherezIt.Api.csproj \
     --connection "Host=localhost;Port=5432;Database=wherezit_dev;Username=wherezit_admin;Password=<ADMIN_PASSWORD>"
   ```

---

## 8. Schema Ownership Contract

> [!IMPORTANT]
> **No Manual Table Provisioning**: Application domain tables are **never** created manually in Google Cloud Console. Domain tables (`users`, `workspaces`, `containers`, `items`, etc.) are owned by their respective domain tickets (`AUTH-003`, `WS-001`, `BOX-001`, `ITEM-001`, etc.) and created strictly via version-controlled EF Core migrations.

---

## 9. Teardown & Cost Controls

To avoid ongoing charges when development is paused:

```bash
cd infrastructure/gcp
./teardown-cloud-sql.sh <EXISTING_WHEREZIT_PROJECT_ID>
```
