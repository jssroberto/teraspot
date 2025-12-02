# TeraSpot Fog Node

The **TeraSpot Fog Node** is an edge application designed to detect parking space occupancy using computer vision (YOLO) and publish real-time updates to AWS IoT Core.

## Infrastructure

The infrastructure for this component is managed via Terraform in `infrastructure/terraform/main.tf`.

- **ECR Repository**: `teraspot-fog`
- **ECR URI**: `755453699050.dkr.ecr.us-east-1.amazonaws.com/teraspot-fog`
- **IAM User**: `teraspot-github-ci` (Used by GitHub Actions for deployment)

## Automated Deployment

The Docker image is automatically built and pushed to Amazon ECR by the GitHub Actions workflow located at `.github/workflows/fog-deploy.yml`.

- **Trigger**: Pushing to the `main` branch.
- **Tags**: Images are tagged with `dev` and the git commit SHA.

## Manual Deployment Guide

If you need to manually build and publish the image (e.g., for testing or hotfixes), follow these steps.

### Prerequisites

- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html) installed and configured.
- [Docker](https://docs.docker.com/get-docker/) installed and running.
- AWS credentials with permissions to push to ECR.

### Steps

1.  **Authenticate with Amazon ECR**
    Retrieve an authentication token and authenticate your Docker client to your registry.

    ```bash
    aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 755453699050.dkr.ecr.us-east-1.amazonaws.com
    ```

2.  **Build the Docker Image**
    Build the image from the `fog` directory.

    ```bash
    cd fog
    docker build -t teraspot-fog:dev .
    ```

3.  **Tag the Image**
    Tag the image with the ECR repository URI.

    ```bash
    docker tag teraspot-fog:dev 755453699050.dkr.ecr.us-east-1.amazonaws.com/teraspot-fog:dev
    ```

4.  **Push the Image**
    Push the tagged image to the ECR repository.
    ```bash
    docker push 755453699050.dkr.ecr.us-east-1.amazonaws.com/teraspot-fog:dev
    ```

## Updating the EC2 Instance

The EC2 instance runs the application as a systemd service (`teraspot-fog`). The service is configured to always pull the latest image on start.

To deploy the latest changes after they have been pushed to ECR:

1.  SSH into the EC2 instance.
2.  Restart the service:
    ```bash
    sudo systemctl restart teraspot-fog
    ```
3.  Check the status to ensure it started correctly:
    ```bash
    sudo systemctl status teraspot-fog
    ```
