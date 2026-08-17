#!/usr/bin/env bash
set -euo pipefail

# Provisioning script for WherezIt IMG-001 Private Storage Bucket
# Note: Cloud mutation operations require human authorization.

PROJECT_ID="wherezit-505615"
BUCKET_NAME="wherezit-505615-images-dev"
REGION="us-central1"
SERVICE_ACCOUNT="wherezit-cloudrun-sa@wherezit-505615.iam.gserviceaccount.com"

echo "=== WherezIt IMG-001 Private Storage Provisioning Script ==="
echo "Project: ${PROJECT_ID}"
echo "Bucket:  gs://${BUCKET_NAME}"
echo "Region:  ${REGION}"
echo ""

echo "[1/3] Creating private Cloud Storage bucket..."
gcloud storage buckets create "gs://${BUCKET_NAME}" \
  --project="${PROJECT_ID}" \
  --location="${REGION}" \
  --default-storage-class=STANDARD \
  --uniform-bucket-level-access

echo "[2/3] Enforcing public access prevention..."
gcloud storage buckets update "gs://${BUCKET_NAME}" \
  --public-access-prevention

echo "[3/3] Granting roles/storage.objectUser to Cloud Run SA..."
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectUser"

echo ""
echo "=== Provisioning commands completed ==="
