#!/usr/bin/env bash
# ==============================================================================
# WherezIt — PLAT-003B: Cloud SQL Teardown & Cost Control Script
# ==============================================================================
# WARNING: This script deletes the development Cloud SQL instance and secrets
# in the specified GCP project. This operation is DESTRUCTIVE.
# ==============================================================================

set -euo pipefail

INSTANCE_NAME="wherezit-db-dev"
SECRET_NAME="wherezit-db-dev-connection-string"

if [ -z "${1:-}" ]; then
  ACTIVE_PROJECT=$(gcloud config get-value project 2>/dev/null || true)
  if [ -z "$ACTIVE_PROJECT" ] || [ "$ACTIVE_PROJECT" = "(unset)" ]; then
    echo "ERROR: Project ID is required."
    echo "Usage: ./teardown-cloud-sql.sh <EXISTING_WHEREZIT_PROJECT_ID>"
    exit 1
  fi
  PROJECT_ID="$ACTIVE_PROJECT"
else
  PROJECT_ID="$1"
fi

echo "======================================================================"
echo "WARNING: DESTRUCTIVE TEARDOWN ACTION"
echo "Project ID : ${PROJECT_ID}"
echo "Instance   : ${INSTANCE_NAME}"
echo "Secret     : ${SECRET_NAME}"
echo "======================================================================"
read -p "Are you sure you want to delete the development database instance? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Teardown cancelled."
    exit 0
fi

echo "Deleting Cloud SQL instance ${INSTANCE_NAME}..."
gcloud sql instances delete "$INSTANCE_NAME" --project="$PROJECT_ID" --quiet || true

echo "Deleting Secret Manager secret ${SECRET_NAME}..."
gcloud secrets delete "$SECRET_NAME" --project="$PROJECT_ID" --quiet || true

echo "Teardown complete."
