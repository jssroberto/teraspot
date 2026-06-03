# Testing Strategy

We prioritize automated testing to ensure the reliability of our serverless backend.

## Framework
*   **Tool**: `pytest`
*   **Version**: Python 3.12 (matching Lambda runtime)

## Testing Levels

### 1. Unit Tests
Located in `backend/lambdas/<function>/tests/`.
These tests isolate the business logic of each function.
*   **Mocking AWS**: We use `moto` to mock AWS services like DynamoDB and S3. This allows us to run tests without needing real AWS credentials or incurring costs.
*   **Mocking Environment**: We use `pytest` fixtures to inject environment variables (`DYNAMODB_TABLE`, `REGION`, etc.) needed by the lambda handler.

### 2. Integration Tests (CI)
Our CI pipeline runs the entire test suite on every commit. It ensures that changes in one module (like `shared/`) do not break dependent functions.

## Running Tests Locally
To run tests on your machine:

```bash
# 1. Synchronize the workspace and install dev dependencies
uv sync

# 2. Run all tests via the Make orchestrator
make test

# 3. Run specific test suite via uv
uv run pytest backend/lambdas/ingest_status/tests/
```
