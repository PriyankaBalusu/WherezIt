# WherezIt Cloud Build CI/CD Pipeline

This directory contains the automation, IAM configurations, and Cloud Build pipeline definitions for the WherezIt monorepo.

## Pipeline Architecture

The Cloud Build pipeline (`cloudbuild.yaml`) executes automated verification and deployment steps:

1. **Frontend Testing & Build**: Runs `npm ci`, `npm run test`, and `npm run build` for the React SPA.
2. **Backend Testing & Build**: Runs `dotnet restore`, `dotnet build`, and `dotnet test` for the .NET Core solution.
3. **Container Packaging**: Builds the Docker container image for `WherezIt.Api`.
4. **Artifact Registry**: Pushes tagged images (`:$COMMIT_SHA` and `:latest`) to `us-central1-docker.pkg.dev/wherezit-505615/wherezit-repo/wherezit-api`.
5. **Cloud Run Deployment**: Deploys `wherezit-api-dev` service in `us-central1`.
6. **Firebase Hosting**: Deploys static SPA assets to Firebase Hosting.

## Provisioning Pipeline Infrastructure

To provision the required Artifact Registry repository and least-privilege service account:

```bash
chmod +x infrastructure/cloudbuild/provision-pipeline.sh
./infrastructure/cloudbuild/provision-pipeline.sh
```

## Security & Least Privilege

- **Service Account**: `wherezit-cloudbuild-sa@wherezit-505615.iam.gserviceaccount.com`
- **IAM Roles**: `roles/run.admin`, `roles/artifactregistry.writer`, `roles/secretmanager.secretAccessor`, `roles/iam.serviceAccountUser`, `roles/firebasehosting.admin`.
- **Zero Key Commits**: No service-account JSON keys are generated or stored in source control.
