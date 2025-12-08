# GitHub Actions CI/CD Overview

## Introduction
TeraSpot utilizes GitHub Actions for Continuous Integration (CI) and Continuous Deployment (CD). This ensures that code changes are automatically tested and deployed to AWS infrastructure, maintaining high code quality and reducing manual operational overhead.

## Workflow Categories
Our CI/CD pipelines are divided into two main categories based on the application architecture:

1.  **Fog Computing (Edge)**: Docker-based deployment for the computer vision components.
2.  **Serverless Backend (Cloud)**: Python-based testing and deployment for AWS Lambda functions.

## Documentation Structure
This documentation is split into detailed guides for each pipeline:

*   **[Fog Pipeline](./workflows.FOG_PIPELINE.md)**: Details the build and push process for the YOLO Docker image.
*   **[Backend CI](./workflows.BACKEND_CI.md)**: Explains the automated testing suite that runs on every commit to the development branch.
*   **[Backend Deployment](./workflows.BACKEND_DEPLOY.md)**: Describes the production deployment process for Lambda functions.

## Required Secrets
All workflows rely on the following GitHub Repository Secrets to authenticate with AWS:

| Secret Name | Description | Required By |
| :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | AWS IAM User Access Key with permissions to deploy. | All workflows |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM User Secret Key. | All workflows |
| `AWS_REGION` | The target AWS Region (e.g., `us-east-1`). | All workflows |
| `ECR_REPOSITORY` | Name of the Amazon ECR repository for the Fog image. | Fog Pipeline |

## Branching Strategy
*   **`dev`**: Integration branch. Pushing here triggers the **Backend CI** workflow to run tests.
*   **`main`**: Production branch. Pushing here triggers the **Backend Deployment** and **Fog Pipeline** workflows to release changes.
