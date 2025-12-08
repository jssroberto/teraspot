# Resource Inventory

This is a list of the primary resources managed by Terraform in `infrastructure/terraform/`.

## Compute (AWS Lambda)
| Resource Name | Function | Env Vars |
| :--- | :--- | :--- |
| `config_saver` | Uploads ROI JSON to S3. | `CONFIG_BUCKET_NAME` |
| `device_command` | Sends MQTT commands to Edge. | `IOT_ENDPOINT`, `SCREENSHOT_BUCKET` |
| `ingest_status` | Processes MQTT updates from Edge. | `DYNAMODB_TABLE`, `HISTORY_TABLE` |
| `read_status` | Returns parking state to Frontend. | `DYNAMODB_TABLE_NAME` |
| `kpi_monitor` | Aggregates analytics stats. | `HISTORY_TABLE`, `CURRENT_TABLE_NAME` |

## Storage
### DynamoDB
*   `parking-spaces-dev`: Stores the *current* real-time state of every space.
    *   **PK**: `space_id`
*   `parking-history`: Stores historical logs of every state change.
    *   Triggered by writes to `parking-spaces-dev` (via shared code, eventually via Streams).

### S3
*   `teraspot-config-dev`: Stores:
    *   `configs/`: ROI JSON files.
    *   `screenshots/`: Images uploaded by devices.

## Networking (API Gateway)
*   **API Name**: `teraspot-api`
*   **Endpoints**:
    *   `POST /config`: Upload new configuration.
    *   `GET /status`: Get all parking spots.
    *   `POST /device/{id}/command`: Send remote command (e.g. screenshot).
    *   `POST /kpi`: Get dashboard metrics.

## Simulation (EC2)
*   **Camera Hub**: A single EC2 instance (`t2.micro` or similar) defined in `ec2_camera.tf`.
    *   **User Data**: Automatically installs Docker and launches 3 containerized instances of the Fog software to simulate a parking lot.
