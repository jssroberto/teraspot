# Backend CI Pipeline

## Overview
**File:** `.github/workflows/lambdas-ci.yml`

The Continuous Integration (CI) pipeline for the backend serves as a quality gate. It automatically runs the unit test suite for all serverless functions whenever changes are proposed or merged into the development branch.

## Triggers
The workflow runs automatically under the following conditions:
1.  **Push to `dev`**: When code is pushed or merged to the `dev` branch.
2.  **Path Filtering**: ONLY runs if changes are detected in the `backend/` directory or the workflow file itself.

### Job: `test`
This job runs the test suite on an `ubuntu-22.04` runner.

### Environment
The job injects mock AWS credentials to prevent tests from accidentally attempting to connect to real AWS services, and locks the packaging dependencies to prevent mutation.
*   `AWS_ACCESS_KEY_ID`: `testing`
*   `AWS_SECRET_ACCESS_KEY`: `testing`
*   `AWS_DEFAULT_REGION`: `us-east-1`
*   `UV_FROZEN`: `1` (Ensures the lockfile is treated as read-only)

### Step Breakdown

1.  **Checkout Code**: Fetches the repository securely using `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10 # v6.0.3`.

2.  **Set up uv**: Sets up the Package Manager using `astral-sh/setup-uv@fac544c07dec837d0ccb6301d7b5580bf5edae39 # v8.2.0`.

3.  **Set up Python**:
    Installs Python 3.12 (matching the Lambda runtime environment).

4.  **Install Dependencies**:
    Synchronizes the workspace packages and testing libraries from `uv.lock` using `uv sync --frozen --python 3.12 --all-packages`.

5.  **Run Tests**:
    The workflow executes `pytest` independently for each microservice module to ensure isolation.
    *   **ingest_status**: Tests the IoT data ingestion logic.
    *   **analytics_notifier**: Tests the DynamoDB Stream processing and WebSocket broadcasting.
    *   **read_status**: Tests the API GET request handler.
    *   **config_saver**: Tests the configuration upload logic (Runs with `CI=true`).
    *   **kpi_monitor**: Tests the metrics aggregation logic.

## Success Criteria
The job only passes if **ALL** test steps complete with exit code 0. If any test fails, the workflow fails, alerting the developers that the code is broken.
