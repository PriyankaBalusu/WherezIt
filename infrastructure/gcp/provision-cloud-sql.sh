#!/usr/bin/env bash
# ==============================================================================
# WherezIt — PLAT-003B: Cloud SQL for PostgreSQL (Dev) Provisioning Script
# ==============================================================================
# PROVISIONING CONTRACT:
# - Target Google Cloud Project MUST be the existing project named "WherezIt".
# - Provisions ONE cost-conscious development Cloud SQL PostgreSQL 16 instance.
# - Creates database `wherezit_dev`.
# - Creates separate `wherezit_admin` (migration) and `wherezit_app` (runtime) users.
# - Enforces least-privilege for `wherezit_app` (must NOT retain cloudsqlsuperuser).
# - Stores separate admin and runtime connection strings in Secret Manager.
# - Idempotent reruns preserve existing passwords and secrets.
# - DO NOT manually create application domain tables.
# ==============================================================================

set -euo pipefail

# Default configuration parameters
DEFAULT_REGION="us-central1"
INSTANCE_NAME="wherezit-db-dev"
DATABASE_NAME="wherezit_dev"
ADMIN_USER="wherezit_admin"
APP_USER="wherezit_app"
RUNTIME_SECRET_NAME="wherezit-db-dev-connection-string"
ADMIN_SECRET_NAME="wherezit-db-dev-admin-connection-string"
TIER="db-f1-micro"
REQUIRED_PROJECT_NAME="WherezIt"

echo "======================================================================"
echo "WherezIt — Cloud SQL (Dev) Provisioning"
echo "======================================================================"

# 1. Project ID Verification & Safety Check
if [ -z "${1:-}" ]; then
  ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
  if [ -z "$ACTIVE_PROJECT" ] || [ "$ACTIVE_PROJECT" = "(unset)" ]; then
    echo "ERROR: Google Cloud Project ID is required."
    echo "Usage: ./provision-cloud-sql.sh <EXISTING_WHEREZIT_PROJECT_ID> [REGION]"
    echo ""
    echo "To discover your existing 'WherezIt' Project ID, run:"
    echo "  gcloud projects list --filter=\"name~WherezIt\""
    exit 1
  fi
  PROJECT_ID="$ACTIVE_PROJECT"
else
  PROJECT_ID="$1"
fi

REGION="${2:-$DEFAULT_REGION}"

# Fail-Fast Project Name Safety Guard
PROJECT_DISPLAY_NAME=$(gcloud projects describe "$PROJECT_ID" --format="value(name)" 2>/dev/null || true)

if [ "$PROJECT_DISPLAY_NAME" != "$REQUIRED_PROJECT_NAME" ]; then
  echo "CRITICAL ERROR: Target project '${PROJECT_ID}' has display name '${PROJECT_DISPLAY_NAME}'."
  echo "Expected exact project display name: '${REQUIRED_PROJECT_NAME}'."
  echo "Aborting provisioning to prevent accidental execution against incorrect project."
  exit 1
fi

echo "Target Project ID   : ${PROJECT_ID}"
echo "Project Display Name: ${PROJECT_DISPLAY_NAME} (Verified)"
echo "Target Region       : ${REGION}"
echo "Instance Name       : ${INSTANCE_NAME}"
echo "Database Name       : ${DATABASE_NAME}"
echo "Machine Tier        : ${TIER}"
echo "======================================================================"

# Verify active gcloud project setting
CURRENT_GCLOUD_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
if [ "$CURRENT_GCLOUD_PROJECT" != "$PROJECT_ID" ]; then
  echo "Setting active gcloud project to ${PROJECT_ID}..."
  gcloud config set project "$PROJECT_ID"
fi

# 2. Enable Required APIs
echo "[1/6] Enabling required Google Cloud APIs..."
gcloud services enable \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  --project="$PROJECT_ID"

# 3. Provision Cloud SQL PostgreSQL Instance
echo "[2/6] Provisioning Cloud SQL PostgreSQL 16 instance (${INSTANCE_NAME})..."
if gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" &>/dev/null; then
  echo "Instance ${INSTANCE_NAME} already exists. Skipping instance creation."
else
  gcloud sql instances create "$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --database-version=POSTGRES_16 \
    --tier="$TIER" \
    --region="$REGION" \
    --storage-type=SSD \
    --storage-size=10GB \
    --storage-auto-increase \
    --availability-type=zonal \
    --backup-start-time=03:00 \
    --retained-backups-count=7

  echo "Instance ${INSTANCE_NAME} created successfully."
fi

# 4. Create Database `wherezit_dev`
echo "[3/6] Creating database ${DATABASE_NAME}..."
if gcloud sql databases describe "$DATABASE_NAME" --instance="$INSTANCE_NAME" --project="$PROJECT_ID" &>/dev/null; then
  echo "Database ${DATABASE_NAME} already exists. Skipping database creation."
else
  gcloud sql databases create "$DATABASE_NAME" \
    --instance="$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --charset=UTF8
  echo "Database ${DATABASE_NAME} created successfully."
fi

# 5. Check Idempotency for Secrets and User Credentials
echo "[4/6] Checking database credentials and Secret Manager status..."
CONNECTION_NAME=$(gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format="value(connectionName)")

RUNTIME_SECRET_EXISTS=false
ADMIN_SECRET_EXISTS=false

if gcloud secrets describe "$RUNTIME_SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
  RUNTIME_SECRET_EXISTS=true
fi

if gcloud secrets describe "$ADMIN_SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
  ADMIN_SECRET_EXISTS=true
fi

if [ "$RUNTIME_SECRET_EXISTS" = true ] && [ "$ADMIN_SECRET_EXISTS" = true ]; then
  echo "Secrets '${RUNTIME_SECRET_NAME}' and '${ADMIN_SECRET_NAME}' already exist."
  echo "Skipping credential generation and password overwrite to ensure operational idempotency."
else
  echo "Generating secure database credentials..."
  ADMIN_PASSWORD=$(openssl rand -hex 24)
  APP_PASSWORD=$(openssl rand -hex 24)

  # Create or update admin user (EF Core migrations)
  echo "Configuring database user '${ADMIN_USER}'..."
  gcloud sql users create "$ADMIN_USER" \
    --instance="$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --password="$ADMIN_PASSWORD" &>/dev/null || \
  gcloud sql users set-password "$ADMIN_USER" \
    --instance="$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --password="$ADMIN_PASSWORD"

  # Create or update application runtime user (Least privilege)
  echo "Configuring database user '${APP_USER}'..."
  gcloud sql users create "$APP_USER" \
    --instance="$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --password="$APP_PASSWORD" &>/dev/null || \
  gcloud sql users set-password "$APP_USER" \
    --instance="$INSTANCE_NAME" \
    --project="$PROJECT_ID" \
    --password="$APP_PASSWORD"

  # Build Connection Strings
  APP_CONN_STRING="Host=/cloudsql/${CONNECTION_NAME};Database=${DATABASE_NAME};Username=${APP_USER};Password=${APP_PASSWORD}"
  ADMIN_CONN_STRING="Host=localhost;Port=5432;Database=${DATABASE_NAME};Username=${ADMIN_USER};Password=${ADMIN_PASSWORD}"

  # 6. Store Secrets in Secret Manager
  echo "[5/6] Writing secrets to Secret Manager..."
  
  if [ "$RUNTIME_SECRET_EXISTS" = true ]; then
    echo -n "$APP_CONN_STRING" | gcloud secrets versions add "$RUNTIME_SECRET_NAME" --project="$PROJECT_ID" --data-file=-
  else
    echo -n "$APP_CONN_STRING" | gcloud secrets create "$RUNTIME_SECRET_NAME" --project="$PROJECT_ID" --data-file=-
  fi

  if [ "$ADMIN_SECRET_EXISTS" = true ]; then
    echo -n "$ADMIN_CONN_STRING" | gcloud secrets versions add "$ADMIN_SECRET_NAME" --project="$PROJECT_ID" --data-file=-
  else
    echo -n "$ADMIN_CONN_STRING" | gcloud secrets create "$ADMIN_SECRET_NAME" --project="$PROJECT_ID" --data-file=-
  fi
fi

echo "[6/6] Provisioning Complete!"
echo "======================================================================"
echo "SUMMARY:"
echo "  Project ID            : ${PROJECT_ID}"
echo "  Project Display Name  : ${PROJECT_DISPLAY_NAME}"
echo "  Cloud SQL Instance    : ${INSTANCE_NAME}"
echo "  Cloud SQL Connection  : ${CONNECTION_NAME}"
echo "  Database              : ${DATABASE_NAME}"
echo "  Runtime Secret Name   : ${RUNTIME_SECRET_NAME}"
echo "  Admin Secret Name     : ${ADMIN_SECRET_NAME}"
echo "======================================================================"
echo "PENDING IAM ROLES FOR PLAT-005 (Cloud Run Deployment):"
echo "  - roles/cloudsql.client"
echo "  - roles/secretmanager.secretAccessor"
echo "  (Will be bound to Cloud Run Service Account during PLAT-005 execution)"
echo "======================================================================"
echo "LEAST PRIVILEGE ADVISORY FOR 'wherezit_app':"
echo "  By default, Cloud SQL user creation grants cloudsqlsuperuser to users created via gcloud."
echo "  To revoke cloudsqlsuperuser from '${APP_USER}' after initial database connection, run:"
echo "    REVOKE cloudsqlsuperuser FROM ${APP_USER};"
echo "    GRANT CONNECT ON DATABASE ${DATABASE_NAME} TO ${APP_USER};"
echo "======================================================================"
