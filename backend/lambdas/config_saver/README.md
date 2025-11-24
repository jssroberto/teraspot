# Config Saver Lambda

This Lambda function manages the configuration files for the TeraSpot system, specifically the Region of Interest (ROI) configurations used by the Fog nodes (Edge devices).

It provides a CRUD-like API to save, retrieve, and list configurations, storing them as JSON files in an S3 bucket.

## Architecture

- **Trigger:** Invoked directly (e.g., via API Gateway or AWS SDK).
- **Storage:** Amazon S3.
- **Format:** JSON files stored at `configs/{config_id}.json`.

## Environment Variables

| Variable             | Description                                    | Default               |
| :------------------- | :--------------------------------------------- | :-------------------- |
| `AWS_REGION`         | AWS Region where the S3 bucket resides.        | `us-east-1`           |
| `CONFIG_BUCKET_NAME` | Name of the S3 bucket to store configurations. | `teraspot-config-dev` |

## Request Payloads

The Lambda expects a JSON payload with an `action` field.

### 1. SAVE Configuration

Saves a new configuration or updates an existing one.

**Payload:**

```json
{
  "action": "SAVE",
  "config": {
    "config_id": "roi-facility-zone",
    "config_type": "zone",
    "value": {
      "name": "Zone A",
      "total_spaces": 50,
      "spaces": [ ... ] // List of polygons
    },
    "updated_by": "admin",
    "active": true
  }
}
```

**Naming Convention:**
For Fog node ROI configurations, use the following `config_id` convention to ensure the Edge device can find its config:
`roi-{facility_id}-{zone_id}`

**Response:**

```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "message": "Config roi-facility-zone saved successfully",
    "config_id": "roi-facility-zone"
  }
}
```

### 2. GET Configuration

Retrieves a specific configuration by ID.

**Payload:**

```json
{
  "action": "GET",
  "config_id": "roi-facility-zone"
}
```

**Response:**

```json
{
  "statusCode": 200,
  "body": {
    "config": {
      "config_id": "roi-facility-zone",
      "config_type": "zone",
      "value": { ... },
      "timestamp": "2023-10-27T10:00:00Z",
      "version": 1
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

## S3 Storage Structure

Configurations are stored as individual JSON files in the S3 bucket defined by `CONFIG_BUCKET_NAME`.

**Key Format:** `configs/{config_id}.json`

**Example:** `s3://teraspot-config-dev/configs/roi-downtown-level1.json`

## Development

### Requirements

- Python 3.13+
- `boto3`

### Running Tests

Tests use `moto` to mock S3 interactions.

```bash
pip install -r requirements-dev.txt
pytest
```
