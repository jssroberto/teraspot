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

The Lambda accepts a JSON payload with an `action` field.

### 1. SAVE Configuration

Saves or updates a configuration.

**Payload:**

```json
{
  "action": "SAVE",
  "config": {
    "config_id": "roi-facility-01-zone-a",
    "config_type": "zone",
    "value": {
      "name": "Zone A",
      "total_spaces": 50
    },
    "spaces": [
      {
        "space_id": "A-01",
        "polygon": [
          [100, 100],
          [200, 100],
          [200, 200],
          [100, 200]
        ]
      },
      {
        "space_id": "A-02",
        "polygon": [
          [210, 100],
          [310, 100],
          [310, 200],
          [210, 200]
        ]
      }
    ],
    "updated_by": "admin",
    "active": true
  }
}
```

**Validation Rules:**

The `config_type` must be one of: `threshold`, `zone`, `device`, `alert_rule`.

| Config Type  | Required Fields in `value`               |
| :----------- | :--------------------------------------- |
| `zone`       | `name`, `total_spaces`                   |
| `device`     | `ip`, `port`                             |
| `threshold`  | Must be a dictionary with numeric values |
| `alert_rule` | (Generic validation)                     |

> **Note:** For `zone` configurations used by Fog nodes, you must include a top-level `spaces` list containing objects with `space_id` and `polygon` (list of `[x, y]` coordinates). This field is passed through to the saved JSON file.

**Response:**

```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "message": "Config roi-facility-01-zone-a saved successfully",
    "config_id": "roi-facility-01-zone-a"
  }
}
```

### 2. GET Configuration

Retrieves a configuration by ID.

**Payload:**

```json
{
  "action": "GET",
  "config_id": "roi-facility-01-zone-a"
}
```

**Response:**

```json
{
  "statusCode": 200,
  "body": {
    "config": {
      "config_id": "roi-facility-01-zone-a",
      "config_type": "zone",
      "value": { ... },
      "timestamp": "2025-11-23T10:00:00Z",
      "version": 1,
      ...
    }
  }
}
```

### 3. LIST Configurations

Lists all configurations of a specific type.

**Payload:**

```json
{
  "action": "LIST",
  "config_type": "zone"
}
```

**Response:**

```json
{
  "statusCode": 200,
  "body": {
    "config_type": "zone",
    "count": 5,
    "items": [ ... ]
  }
}
```

## Local Development

### Prerequisites

- Python 3.13+
- `pip`

### Installation

```bash
pip install -r requirements.txt
```

### Running Tests

Tests use `moto` to mock S3 interactions, so no real AWS credentials are required for testing.

```bash
pip install -r requirements-dev.txt
pytest
```
