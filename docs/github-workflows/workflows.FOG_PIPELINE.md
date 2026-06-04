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
    Uses `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6.0.3` to fetch the repository content securely.

2.  **Set up Python and uv**:
    Sets up the Package Manager and installs Python 3.12 using the shared local composite action `./.github/actions/setup-python-uv`.

3.  **Export Pinned Dependencies**:
    Compiles/exports deterministic requirements file for Fog components using `uv export --frozen --package teraspot-fog --output-file fog/requirements.txt`.

4.  **Configure AWS Credentials**:
    Uses `aws-actions/configure-aws-credentials@e7f100cf4c008499ea8adda475de1042d6975c7b # v6.2.0` to authenticate with AWS using the repository secrets:
    *   `AWS_ACCESS_KEY_ID`
    *   `AWS_SECRET_ACCESS_KEY`
    *   `AWS_REGION`

5.  **Login to Amazon ECR**:
    Uses `aws-actions/amazon-ecr-login@fa648b43de3d4d023bcb3f89ed6940096949c419 # v2.1.5` to retrieve a docker login token for the private ECR registry.

6.  **Set up Docker Buildx**:
    Uses `docker/setup-buildx-action@d7f5e7f509e45cec5c76c4d5afdd7de93d0b3df5 # v4.1.0` to install Buildx, enabling advanced Docker build features (like caching).

7.  **Build and push Docker image**:
    Uses `docker/build-push-action@f9f3042f7e2789586610d6e8b85c8f03e5195baf # v7.2.0` to:
    *   **Context**: Build from the `./fog` directory.
    *   **Platform**: `linux/amd64` (Standard EC2/Desktop architecture).
    *   **Tags**:
        *   `:dev` (Latest mutable tag)
        *   `:git-<commit_sha>` (Immutable tag for specific versioning)
    *   **Caching**: Uses GitHub Actions cache (`gha`) to speed up subsequent builds.

## Artifacts produced
*   **Docker Image**: Pushed to the Amazon ECR repository specified in `ECR_REPOSITORY` secret.
