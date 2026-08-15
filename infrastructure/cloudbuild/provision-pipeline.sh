#!/usr/bin/env bash
set -euo pipefail

# Provisioning script for Cloud Build pipeline and IAM resources
PROJECT_ID="$(gcloud config get-value project 2>/dev/null || echo "")"
REQUIRED_PROJECT="wherezit-505615"

if [ "$PROJECT_ID" != "$REQUIRED_PROJECT" ]; then
    echo "ERROR: Current gcloud project is '$PROJECT_ID', but '$REQUIRED_PROJECT' is required." >&2
    exit 1
fi

PROJECT_NAME="$(gcloud projects describe "$PROJECT_ID" --format="value(name)" 2>/dev/null || echo "")"
if [ "$PROJECT_NAME" != "WherezIt" ]; then
    echo "ERROR: Project display name is '$PROJECT_NAME', expected 'WherezIt'." >&2
    exit 1
fi

echo "=== Verified GCP Project: $PROJECT_NAME ($PROJECT_ID) ==="

echo "Enabling required APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    --project="$PROJECT_ID"

REGION="us-central1"
REPO_NAME="wherezit-repo"

echo "Checking Artifact Registry repository '$REPO_NAME'..."
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Creating Artifact Registry repository '$REPO_NAME'..."
    gcloud artifacts repositories create "$REPO_NAME" \
        --repository-format=docker \
        --location="$REGION" \
        --description="WherezIt Docker Container Repository" \
        --project="$PROJECT_ID"
fi

SA_NAME="wherezit-cloudbuild-sa"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Checking Cloud Build Service Account '$SA_EMAIL'..."
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Creating Service Account '$SA_NAME'..."
    gcloud iam service-accounts create "$SA_NAME" \
        --display-name="WherezIt Cloud Build Pipeline Service Account" \
        --project="$PROJECT_ID"
fi

ROLES=(
    "roles/run.admin"
    "roles/artifactregistry.writer"
    "roles/secretmanager.secretAccessor"
    "roles/iam.serviceAccountUser"
    "roles/firebasehosting.admin"
    "roles/logging.logWriter"
)

echo "Granting least-privilege IAM roles to '$SA_EMAIL'..."
for ROLE in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="$ROLE" \
        --condition=None >/dev/null
done

echo "=== Cloud Build Pipeline Infrastructure Provisioned Successfully ==="
