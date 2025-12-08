# Fog Deployment Pipeline

## Overview
**File:** `.github/workflows/fog-deploy.yml`

This workflow handles the building and distribution of the Docker image used by the Edge (Fog) devices. It ensures that the latest version of the YOLO processor code is available in Amazon Elastic Container Registry (ECR) for devices to pull.

## Triggers
The workflow runs automatically under the following conditions:
1.  **Push to `main`**: When code changes are merged into the `main` branch.
2.  **Path Filtering**: ONLY runs if changes are detected in the `fog/` directory or the workflow file itself. This prevents unnecessary builds when only frontend or backend code changes.
3.  **Manual Dispatch**: Can be manually triggered from the GitHub Actions UI (`workflow_dispatch`).

## Job: `build-and-push`
This single job performs the entire build process on an `ubuntu-22.04` runner.

### Step Breakdown

1.  **Checkout Code**:
    Uses `actions/checkout@v4` to fetch the repository content.

2.  **Configure AWS Credentials**:
    Uses `aws-actions/configure-aws-credentials@v4` to authenticate with AWS using the repository secrets:
    *   `AWS_ACCESS_KEY_ID`
    *   `AWS_SECRET_ACCESS_KEY`
    *   `AWS_REGION`

3.  **Login to Amazon ECR**:
    Uses `aws-actions/amazon-ecr-login@v2` to retrieve a docker login token for the private ECR registry.

4.  **Set up Docker Buildx**:
    Uses `docker/setup-buildx-action@v3` to install Buildx, enabling advanced Docker build features (like caching).

5.  **Build and push Docker image**:
    Uses `docker/build-push-action@v5` to:
    *   **Context**: Build from the `./fog` directory.
    *   **Platform**: `linux/amd64` (Standard EC2/Desktop architecture).
    *   **Tags**:
        *   `:dev` (Latest mutable tag)
        *   `:git-<commit_sha>` (Immutable tag for specific versioning)
    *   **Caching**: Uses GitHub Actions cache (`gha`) to speed up subsequent builds.

## Artifacts produced
*   **Docker Image**: Pushed to the Amazon ECR repository specified in `ECR_REPOSITORY` secret.
