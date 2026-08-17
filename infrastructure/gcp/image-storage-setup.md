# IMG-001 — Private Cloud Storage Foundation Setup

## Overview
WherezIt uses a private Google Cloud Storage bucket to persist item, container, and capture images. Access is server-mediated; object ACLs and public access are disabled.

## Configuration Details
- **Project ID**: `wherezit-505615`
- **Bucket Name**: `wherezit-505615-images-dev`
- **Region**: `us-central1`
- **Storage Class**: `STANDARD`
- **Uniform Bucket-Level Access**: `ENABLED`
- **Public Access Prevention**: `ENFORCED`
- **Public Access**: `NONE`
- **Runtime Identity**: `wherezit-cloudrun-sa@wherezit-505615.iam.gserviceaccount.com`
- **Runtime IAM Role**: `roles/storage.objectUser` (granted at bucket scope)

## Provisioning Script
The shell script `infrastructure/gcp/provision-image-storage.sh` contains the exact commands required to create and configure the private bucket once authorized.

## Verification
To verify bucket security read-only after execution:
```bash
gcloud storage buckets describe gs://wherezit-505615-images-dev --format="yaml(name, location, storageClass, iamConfiguration)"
```
