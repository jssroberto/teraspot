# Dependencies & Requirements

The backend uses standard Python package management (`pip`).

## Requirements Files

*   **`requirements.txt`**: 
    *   Found in each `backend/lambdas/<lambda_name>/` directory.
    *   Contains the production dependencies required for that specific function to run (e.g., `requests`, `pydantic`).
    *   These are installed during the build/deploy process.

*   **`backend/requirements-test.txt`**:
    *   Contains development and testing dependencies shared across the project.
    *   Key packages:
        *   `pytest`: The testing framework.
        *   `botocore-stubs`, `boto3-stubs`: Type hints for AWS SDK.
        *   `moto`: Library for mocking AWS services (DynamoDB, S3, etc.) locally during tests.

## Dependency Management
Since AWS Lambda has a size limit, we avoid a single monolithic `requirements.txt` for the whole project. Instead, each function manages its own lightweight set of dependencies.
