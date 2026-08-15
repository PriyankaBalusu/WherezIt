#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REGION="us-central1"
EXPECTED_PROJECT_NAME="WherezIt"
INSTANCE_NAME="wherezit-db-dev"
DATABASE_NAME="wherezit_dev"
ADMIN_USER="wherezit_admin"
APP_USER="wherezit_app"
APP_SECRET_NAME="wherezit-db-dev-connection-string"
ADMIN_SECRET_NAME="wherezit-db-dev-admin-connection-string"
TIER="db-f1-micro"

log(){ printf '%s\n' "$*"; }
fail(){ printf 'ERROR: %s\n' "$*" >&2; exit 1; }

command -v gcloud >/dev/null 2>&1 || fail "gcloud CLI is not installed or not in PATH."
command -v openssl >/dev/null 2>&1 || fail "openssl is required."

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null || true)}"
[ -n "$PROJECT_ID" ] && [ "$PROJECT_ID" != "(unset)" ] || fail "Usage: ./provision-cloud-sql.sh <EXISTING_WHEREZIT_PROJECT_ID> [REGION]"
REGION="${2:-$DEFAULT_REGION}"

PROJECT_NAME="$(gcloud projects describe "$PROJECT_ID" --format='value(name)' 2>/dev/null || true)"
[ "$PROJECT_NAME" = "$EXPECTED_PROJECT_NAME" ] || fail "Project '$PROJECT_ID' is '$PROJECT_NAME', not '$EXPECTED_PROJECT_NAME'."

CURRENT_PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
  gcloud config set project "$PROJECT_ID" >/dev/null
fi

ACTIVE_ACCOUNT="$(gcloud config get-value account 2>/dev/null || true)"
BILLING_ENABLED="$(gcloud beta billing projects describe "$PROJECT_ID" --format='value(billingEnabled)' 2>/dev/null || true)"
if [ "$BILLING_ENABLED" != "True" ] && [ "$BILLING_ENABLED" != "true" ]; then
  fail "Billing is not confirmed as enabled for project '$PROJECT_ID'."
fi

log "======================================================================"
log "WherezIt — Cloud SQL (Dev) Provisioning"
log "======================================================================"
log "Project Name      : $PROJECT_NAME"
log "Target Project ID : $PROJECT_ID"
log "Active Account    : $ACTIVE_ACCOUNT"
log "Billing Enabled   : $BILLING_ENABLED"
log "Target Region     : $REGION"
log "Instance Name     : $INSTANCE_NAME"
log "Database Name     : $DATABASE_NAME"
log "Machine Tier      : $TIER"
log "Edition           : ENTERPRISE"
log "======================================================================"

log "[1/6] Enabling required Google Cloud APIs..."
gcloud services enable sqladmin.googleapis.com secretmanager.googleapis.com --project="$PROJECT_ID"

log "[2/6] Provisioning Cloud SQL PostgreSQL 16 instance ($INSTANCE_NAME)..."
if gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" &>/dev/null; then
  log "Instance $INSTANCE_NAME already exists. Skipping creation."
else
  gcloud sql instances create "$INSTANCE_NAME"     --project="$PROJECT_ID"     --database-version=POSTGRES_16     --edition=ENTERPRISE     --tier="$TIER"     --region="$REGION"     --storage-type=SSD     --storage-size=10GB     --storage-auto-increase     --availability-type=zonal     --backup-start-time=03:00     --retained-backups-count=7
fi

log "[3/6] Creating database $DATABASE_NAME..."
if gcloud sql databases describe "$DATABASE_NAME" --instance="$INSTANCE_NAME" --project="$PROJECT_ID" &>/dev/null; then
  log "Database $DATABASE_NAME already exists. Skipping creation."
else
  gcloud sql databases create "$DATABASE_NAME" --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --charset=UTF8
fi

user_exists() {
  gcloud sql users list --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --format='value(name)' 2>/dev/null | grep -Fxq "$1"
}
secret_exists() {
  gcloud secrets describe "$1" --project="$PROJECT_ID" &>/dev/null
}
create_secret() {
  printf '%s' "$2" | gcloud secrets create "$1" --project="$PROJECT_ID" --replication-policy=automatic --data-file=- >/dev/null
}

CONNECTION_NAME="$(gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format='value(connectionName)')"

log "[4/6] Provisioning database users and credentials..."

if user_exists "$ADMIN_USER"; then
  secret_exists "$ADMIN_SECRET_NAME" || fail "Admin user exists but admin secret is missing. Refusing implicit rotation."
  log "Admin user and secret already exist. No rotation performed."
else
  secret_exists "$ADMIN_SECRET_NAME" && fail "Admin secret exists but admin user does not."
  ADMIN_PASSWORD="$(openssl rand -hex 24)"
  gcloud sql users create "$ADMIN_USER" --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --password="$ADMIN_PASSWORD" >/dev/null
  ADMIN_CONN_STRING="Host=127.0.0.1;Port=5432;Database=$DATABASE_NAME;Username=$ADMIN_USER;Password=$ADMIN_PASSWORD"
  create_secret "$ADMIN_SECRET_NAME" "$ADMIN_CONN_STRING"
  unset ADMIN_PASSWORD ADMIN_CONN_STRING
fi

if user_exists "$APP_USER"; then
  secret_exists "$APP_SECRET_NAME" || fail "Runtime user exists but runtime secret is missing. Refusing implicit rotation."
  log "Runtime user and secret already exist. No rotation performed."
else
  secret_exists "$APP_SECRET_NAME" && fail "Runtime secret exists but runtime user does not."
  APP_PASSWORD="$(openssl rand -hex 24)"
  gcloud sql users create "$APP_USER"     --instance="$INSTANCE_NAME"     --project="$PROJECT_ID"     --password="$APP_PASSWORD"     --database-roles=pg_read_all_data,pg_write_all_data >/dev/null
  APP_CONN_STRING="Host=/cloudsql/$CONNECTION_NAME;Database=$DATABASE_NAME;Username=$APP_USER;Password=$APP_PASSWORD"
  create_secret "$APP_SECRET_NAME" "$APP_CONN_STRING"
  unset APP_PASSWORD APP_CONN_STRING
fi

log "[5/6] Verifying provisioned resources..."
gcloud sql instances describe "$INSTANCE_NAME" --project="$PROJECT_ID" --format='table(name,region,databaseVersion,settings.edition,settings.tier,state)'
gcloud sql databases list --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --format='table(name,charset,collation)'
gcloud sql users list --instance="$INSTANCE_NAME" --project="$PROJECT_ID" --format='table(name,type,databaseRoles)'
gcloud secrets describe "$APP_SECRET_NAME" --project="$PROJECT_ID" --format='value(name)' >/dev/null
gcloud secrets describe "$ADMIN_SECRET_NAME" --project="$PROJECT_ID" --format='value(name)' >/dev/null

log "[6/6] Provisioning Complete!"
log "======================================================================"
log "Project ID           : $PROJECT_ID"
log "Cloud SQL Instance   : $INSTANCE_NAME"
log "Cloud SQL Connection : $CONNECTION_NAME"
log "Database             : $DATABASE_NAME"
log "Runtime Secret       : $APP_SECRET_NAME"
log "Admin Secret         : $ADMIN_SECRET_NAME"
log "======================================================================"
log "Cloud Run IAM is deferred to PLAT-005:"
log "  roles/cloudsql.client"
log "  roles/secretmanager.secretAccessor"