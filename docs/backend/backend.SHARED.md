# Shared Backend Libraries

To maintain the **DRY (Don't Repeat Yourself)** principle, common logic is extracted into the `backend/shared/` directory. These modules are available to all Lambda functions.

## Directory: `backend/shared/utils/`

### 1. `dlq__handler.py`
**Purpose**: Standardized error handling for failed asynchronous messages.
**Usage**: When a Lambda cannot process a message (e.g., malformed JSON) after retries, it sends it here instead of discarding it.

```python
from shared.utils.dlq__handler import sendMessageDLQ

try:
    process(event)
except CriticalError as e:
    sendMessageDLQ({
        "original_payload": event,
        "error": str(e),
        "source": "ingest_status"
    })
```

**Environment Dependencies**:
*   `SQS_URL`: The URL of the Dead Letter Queue.
*   `AWS_REGION`: Region to connect to.

---

### 2. `constants.py`
**Purpose**: Central repository for system-wide constants strings to avoid "Magic Strings".
*   *Current State*: Placeholder for future standardized status strings (e.g., `STATUS_OCCUPIED = "occupied"`).

### 3. `dynamodb_models.py`
**Purpose**: Pydantic models or Single Table Design definitions used for type validation.
*   *Current State*: Placeholder. Future use will include `SpaceItem` and `HistoryItem` class definitions to enforce schema consistency across `ingest_status` and `kpi_monitor`.

---

## Deployment Note
When `backend` code is deployed via GitHub Actions or zipped locally, the `shared/` directory is copied into the root of the Lambda package (or installed as a layer) so that `import shared...` works seamlessly in the runtime environment.
