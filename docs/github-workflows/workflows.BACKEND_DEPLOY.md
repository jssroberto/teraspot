# Backend Deployment Pipeline

## Overview
**File:** `.github/workflows/lambdas-deploy.yml`

This workflow is responsible for pushing backend code changes to production. It follows a "Test then Deploy" strategy, ensuring that code is only updated in AWS if it passes all unit tests first.

## Triggers
The workflow runs automatically under the following conditions:
1.  **Push to `main`**: When code is merged into the production branch.
2.  **Path Filtering**: ONLY runs if changes are detected in the `backend/` directory or the workflow file itself.

## Job 1: `test`
Identical to the **Backend CI** job. It runs all unit tests.
*   **Purpose**: Safety check. Even if tests passed on `dev`, we run them again on `main` to be 100% sure before modifying production infrastructure.

## Job 2: `deploy`
This job runs **only if** the `test` job succeeds. It updates the code for every Lambda function in the system.

### Deployment Process (Per Function)
The workflow iterates through each Lambda function and delegates packaging and deployment to the shared local composite action `./.github/actions/deploy-lambda`. 

Under the hood, this composite action:
1.  **Packages the Lambda**: Invokes `scripts/package-lambda.sh` to copy the handler code and shared utilities (`backend/shared/utils`) into a temporary `package/` directory, compiles/installs dependencies from `uv.lock` using `uv export --frozen` and `uv pip install`, and zips the results to `lambda.zip`.
2.  **Deploys to AWS**: Uses the AWS CLI (`aws lambda update-function-code`) to upload the zip file directly to the corresponding Lambda function target.

### Deployed Functions mapping

| Directory | AWS Function Name | Description |
| :--- | :--- | :--- |
| `lambdas/ingest_status` | `teraspot-ingest-status` | IoT Ingestion |
| `lambdas/analytics_notifier` | `teraspot-analytics-notifier` | Stream Processing |
| `lambdas/read_status` | `teraspot-read-status` | API Read |
| `lambdas/config_saver` | `teraspot-config-saver` | Ops Config |
| `lambdas/kpi_monitor` | `teraspot-kpi-monitor` | Metrics API |
| `lambdas/device_command` | `teraspot-device-command` | Edge Control |
| `lambdas/ws_connect` | `teraspot-ws-connect` | WebSocket Auth |
| `lambdas/ws_disconnect` | `teraspot-ws-disconnect` | WebSocket Cleanup |

## Permissions
The deployment job requires an IAM User (via secrets) with the `lambda:UpdateFunctionCode` permission for all listed functions.
