# Dependencies & Requirements

The backend uses **`uv`** for workspaces and Python package management.

## Dependency Configuration

*   **`pyproject.toml` (Root)**:
    *   Defines workspace members, global python requirements, and shared development/testing dependencies (`[dependency-groups]`).
    
*   **`backend/shared/pyproject.toml`**:
    *   Defines shared backend utility packages and their dependencies (e.g., `boto3`).

*   **`backend/lambdas/<lambda_name>/pyproject.toml`**:
    *   Defines the dependencies required for that specific Lambda function to run.
    *   Includes workspace references to `teraspot-shared` where applicable.

## Dependency Management & Workspaces
Since AWS Lambda has package size limits, we avoid installing a single monolithic dependency bundle for the entire project. Instead, each function maintains its own scoped dependencies in its local `pyproject.toml`.

Local development is coordinated via the root workspace:
```bash
# Synchronize all workspace member dependencies
uv sync
```
