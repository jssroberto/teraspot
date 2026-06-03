# Config Saver Lambda

This Lambda function manages the configuration files for the TeraSpot system. It serves as the source of truth for Edge (Fog) nodes, storing configurations as JSON files in an S3 bucket.

## Features

- **CRUD Operations**: Save, Get, and List configurations.
- **S3 Storage**: Persists data as JSON files in a designated S3 bucket.
- **Validation**: Enforces schema validation for different configuration types.

## Architecture

- **Trigger**: API Gateway or AWS SDK invocation.
- **Storage**: Amazon S3.
- **Key Format**: `configs/{config_id}.json`

## Environment Variables

| Variable             | Description                   | Default               |
| :------------------- | :---------------------------- | :-------------------- |
| `AWS_REGION`         | AWS Region for the S3 bucket. | `us-east-1`           |
| `CONFIG_BUCKET_NAME` | Name of the S3 bucket.        | `teraspot-config-dev` |

## API Reference

> **IMPORTANT:** The full API documentation, including payload schemas, `curl` examples, and error responses, has been moved to the central **[API Documentation](../../../../docs/API.md)**.

Please refer to `docs/API.md` for all interaction details.

## Local Development

### Prerequisites

- Python 3.13+
- `uv`

### Installation & Sync

To synchronize the workspace and setup all packages, run from the root of the workspace:

```bash
uv sync
```

### Running Tests

Tests use `moto` to mock S3 interactions, so no real AWS credentials are required for testing.

```bash
# Run pytest specifically for this lambda
uv run pytest backend/lambdas/config_saver/tests/
```
