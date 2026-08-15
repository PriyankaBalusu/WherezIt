# WherezIt — Google Cloud Infrastructure (GCP)

This directory contains infrastructure-as-code scripts and setup documentation for Google Cloud platform components.

## Contents

- [cloud-sql-setup.md](./cloud-sql-setup.md) — Comprehensive guide for Google Cloud SQL (PostgreSQL 16) dev environment, IAM roles, Secret Manager, Cloud Run Unix socket connection, and EF Core migrations.
- [provision-cloud-sql.sh](./provision-cloud-sql.sh) — Executable shell script to provision `wherezit-db-dev` Cloud SQL instance, `wherezit_dev` database, users, and secrets in the existing GCP project `WherezIt`.
- [teardown-cloud-sql.sh](./teardown-cloud-sql.sh) — Teardown script to safely destroy dev Cloud SQL resources to avoid ongoing billing.

## Quick Execution

```bash
# Provision Cloud SQL Dev Instance in Existing 'WherezIt' GCP Project
./provision-cloud-sql.sh <EXISTING_WHEREZIT_PROJECT_ID> [us-central1]

# Teardown Cloud SQL Dev Instance
./teardown-cloud-sql.sh <EXISTING_WHEREZIT_PROJECT_ID>
```
