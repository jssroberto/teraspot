# Lambda Functions Detailed Guide

This document provides a deep dive into the logic, inputs, and outputs of each Lambda function in the TeraSpot backend.

---

## 1. ingest_status (`ingest_status`)
**Type**: Event Processor (IoT)
**Trigger**: AWS IoT Core (MQTT Topic `teraspot/status/#`)

### Responsibility
The primary entry point for real-time data from the edge. It receives parking space updates, validates them, and writes the *latest state* to DynamoDB. It handles both "Occupancy updates" and "Device Offline (LWT)" events.

### Environment Variables
| Variable | Description | Example |
| :--- | :--- | :--- |
| `DYNAMODB_TABLE` | Target table for real-time state. | `parking-spaces-dev` |
| `HISTORY_TABLE` | (Optional) Direct write to history - mostly handled by Streams now. | `parking-history` |
| `AWS_REGION` | AWS Region. | `us-east-1` |

### Input Event (MQTT Payload)
*   **Standard Update**:
    ```json
    {
      "device_id": "cam-01",
      "timestamp": "2023-10-27T10:00:00Z",
      "data": [
        { "space_id": "A-01", "status": "occupied", "confidence": 0.95 },
        { "space_id": "A-02", "status": "vacant", "confidence": 0.88 }
      ]
    }
    ```
*   **Last Will & Testament (LWT)** (Offline):
    ```json
    {
      "device_id": "cam-01",
      "status": "offline",
      "timestamp": "2023-10-27T10:05:00Z"
    }
    ```

### Logic Flow
1.  **Parse Payload**: Extracts `device_id` and checks for "offline" status.
2.  **LWT Handling**:
    *   If status is "offline", it queries DynamoDB GSI to find *all* spaces managed by `cam-01`.
    *   Updates each space to `status="unknown"` or `is_alive=false` to indicate the sensor is down.
3.  **Data Validation**:
    *   Iterates through `data` list.
    *   Checks if `confidence` is valid (0.0 - 1.0).
4.  **Database Write**:
    *   Writes items to `parking-spaces-dev` using `batch_writer` (or `put_item`).
    *   Sets `processed_timestamp` to measure system latency later.

---

## 2. analytics_notifier (`analytics_notifier`)
**Type**: Stream Processor (DynamoDB) & Scheduled Job
**Trigger**: DynamoDB Stream (`parking-spaces-dev`) OR EventBridge (Every 5 mins)

### Responsibility
The "brain" of the real-time feedback loop. It watches for changes in the database to notify clients and runs periodic health checks.

### Environment Variables
| Variable | Description |
| :--- | :--- |
| `IOT_ENDPOINT` | AWS IoT Core Endpoint (For WebSocket publishing). |
| `SNS_TOPIC_ARN` | Topic for critical alerts (e.g., >95% full). |
| `SQS_QUEUE_URL` | Queue for low-priority alerts (e.g., sensor drift). |

### Logic Flow (Stream Mode)
1.  **Change Detection**: Receives a batch of DynamoDB Stream records.
2.  **Comparison**: Compares `NewImage` vs `OldImage`.
    *   If `status` changed (e.g., `vacant` -> `occupied`), it proceeds.
    *   If only `timestamp` changed (heartbeat), it ignores (to save WebSocket bandwidth).
3.  **Client Notification**:
    *   Formats a lightweight JSON: `{ "space_id": "A-01", "status": "occupied" }`.
    *   Publishes to MQTT topic `teraspot/updates` (which Frontends subscribe to).
4.  **Alerting**:
    *   **Low Confidence**: If `confidence < 0.75`, sends warning to SQS (for ML team review).
    *   **High Occupancy**: If total occupancy > 95%, publishes to SNS (SMS/Email to Mgr).

### Logic Flow (Scheduled Mode)
1.  **Health Check**: Scans table for `last_seen` timestamps.
2.  **Dead Sensor Detection**: If a camera hasn't reported in > 5 minutes, marks it as `inactive` and sends an alert.

---

## 3. kpi_monitor (`kpi_monitor`)
**Type**: API Handler (REST)
**Trigger**: API Gateway (`POST /kpi`)

### Responsibility
Aggregates raw data into high-level business intelligence metrics.

### Key Functions
| KPI ID | Name | Formula |
| :--- | :--- | :--- |
| **KPI 1** | Occupancy Rate | `(Occupied / Total) * 100` |
| **KPI 4** | Avg Confidence | Mean confidence of all "occupied" detections in last 15m. |
| **KPI 7** | System Latency | `Mean(processed_ts - created_ts)` |
| **KPI 8** | Dwell Time | Avg time between `occupied` and `vacant` state in History table. |
| **KPI 11**| Prediction | Linear regression on last 7 days to predict next 24h. |

### Logic Flow
1.  Receives JSON body specifying which KPI to calculate (or "all").
2.  **Queries**: Performs massive `Scan` operations (Note: optimized in prod to use Query) on `parking-spaces-dev` (live) or `parking-history` (trends).
3.  **Aggregation**: Python math (statistics module) processes lists of records.
4.  **Response**: Returns complex JSON object for Admin Dashboard charts.

---

## 4. read_status (`read_status`)
**Type**: API Handler (REST)
**Trigger**: API Gateway (`GET /status`)

### Responsibility
Serves the "Snapshot" of the parking lot to the Client App when it first opens.

### Endpoints
*   `GET /status`: Returns list of ALL spaces.
*   `GET /status/occupied`: Filtered list.
*   `GET /status/stats`: Summary counts only (fast).

### Logic Flow
1.  **Router**: checks `event['path']`.
2.  **Scan**: Reads `parking-spaces-dev`.
3.  **Format**: Converts DynamoDB `Decimal` types to Python `float` for JSON serialization.
4.  **CORS**: Adds `Access-Control-Allow-Origin: *` headers.

---

## 5. config_saver (`config_saver`)
**Type**: API Handler (REST)
**Trigger**: API Gateway (`POST /config`)

### Responsibility
Allows Admins to update system configuration (e.g., drawing new parking lines) without redeploying code.

### Logic Flow
1.  **Validation**: Checks if JSON payload has required fields (`threshold_id`, `spaces` list, `polygon` points).
2.  **Versioning**: Generates a unique ID (e.g., `roi-cam-01`).
3.  **Persist**: Saves JSON file to S3 Bucket `teraspot-config-dev/configs/`.
4.  **Audit**: Logs the user who made the change (if available in token).

---

## 6. device_command (`device_command`)
**Type**: API Handler (REST)
**Trigger**: API Gateway (`POST /device/{id}/command`)

### Responsibility
Functions as a Remote Control for the Edge devices.

### Supported Commands
1.  **Screenshot**:
    *   Generates S3 **Presigned URLs** (1 PUT for upload, 1 GET for viewing).
    *   Sends MQTT command to device: `{ "cmd": "screenshot", "url": "..." }`.
    *   Returns the GET URL to the frontend so it can display the image once uploaded.
2.  **Reload Config**:
    *   Sends MQTT command `{ "cmd": "reload" }`.

---

## 7. ws_connect (`ws_connect`)
**Type**: API Handler (WebSocket)
**Trigger**: API Gateway (`$connect` route)

### Responsibility
Handles new WebSocket connection requests from the Frontend clients. It stores the `connection_id` so the backend can push updates later.

### Environment Variables
| Variable | Description | Example |
| :--- | :--- | :--- |
| `CONNECTIONS_TABLE` | DynamoDB table to store active connection IDs. | `websocket-connections-dev` |

### Logic Flow
1.  **Extract ID**: Gets `connection_id` from `event["requestContext"]["connectionId"]`.
2.  **Persist**: Writes `{ "connection_id": "..." }` to the DynamoDB Connections Table.
3.  **Acknowledge**: Returns `200 OK` to confirm the connection is established.

---

## 8. ws_disconnect (`ws_disconnect`)
**Type**: API Handler (WebSocket)
**Trigger**: API Gateway (`$disconnect` route)

### Responsibility
Cleans up connection data when a user closes the app or loses internet connectivity.

### Environment Variables
| Variable | Description | Example |
| :--- | :--- | :--- |
| `CONNECTIONS_TABLE` | DynamoDB table to remove connection IDs from. | `websocket-connections-dev` |

### Logic Flow
1.  **Extract ID**: Gets `connection_id` from `event`.
2.  **Delete**: Removes the item from DynamoDB to stop future message broadcast attempts to this dead connection.
