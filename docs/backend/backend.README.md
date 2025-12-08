# Serverless Backend Documentation

## Overview
The TeraSpot backend is built on a **Serverless Architecture** using AWS Lambda, DynamoDB, and API Gateway. This approach allows the system to scale automatically with demand while keeping operational costs low (pay-per-use).

## Directory Structure (`backend/`)

| Directory | Description |
| :--- | :--- |
| **`lambdas/`** | Contains the source code for each microservice (Lambda function). Each subdirectory is an independent deployment unit. |
| **`shared/`** | Contains common Python code (utilities, models) used across multiple Lambda functions to ensure consistency (DRY Principle). |
| **`tests/`** | Global test configuration and fixtures. (Note: Unit tests are co-located within each lambda's directory). |

## Core Principles
1.  **Event-Driven**: Most actions are triggered by events (e.g., MQTT message, Database change, API call), not by polling.
2.  **Stateless Compute**: Lambda functions are stateless. All persistent state is stored in DynamoDB or S3.
3.  **Isolation**: Each Lambda function runs in its own environment and can be deployed independently.

## Detailed Documentation
*   **[Lambda Functions](./backend.LAMBDAS.md)**: Deep dive into each microservice, including `ingest_status`, `analytics_notifier`, and more.
*   **[Shared Libraries](./backend.SHARED.md)**: Documentation for the common utilities in `shared/`.
*   **[Testing Strategy](./backend.TESTING.md)**: How we verify code quality using `pytest`.
*   **[Dependencies](./backend.DEPENDENCIES.md)**: Explanation of `requirements.txt` and package management.
