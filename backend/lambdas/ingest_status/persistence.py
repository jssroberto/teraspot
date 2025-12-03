"""DynamoDB helpers for ingest_status."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, Iterable, Tuple, Optional

import logging
from botocore.exceptions import ClientError

logger = logging.getLogger(__name__)


def get_current_state(space_id: str, table) -> Optional[Dict[str, Any]]:
    """Fetch the current state of a space."""
    try:
        response = table.get_item(Key={"space_id": space_id})
        return response.get("Item")
    except ClientError as e:
        logger.error("Failed to get current state for %s: %s", space_id, e)
        return None


def save_current(items: Iterable[Dict[str, Any]], table) -> None:
    for item in items:
        try:
            # Ensure we don't save unwanted fields if they slipped in
            clean_item = {k: v for k, v in item.items() if k not in ["data_source", "type"]}
            table.put_item(Item=clean_item)
            logger.info("Current state saved: %s = %s", item["space_id"], item["status"])
        except Exception as exc: 
            logger.error("Current save error: %s", exc)


def save_history(items: Iterable[Dict[str, Any]], history_table) -> None:
    for item in items:
        history_item = {
            "space_id": item["space_id"],
            "timestamp": item.get("timestamp"),
            "status": item["status"],
            "confidence": Decimal(str(item["confidence"])),
            "device_id": item.get("device_id", "unknown"),
            "facility_id": item.get("facility_id", "unknown"),
            "zone_id": item.get("zone_id", "unknown"),
            "event_id": item.get("event_id"), 
            # Explicitly exclude data_source and type
        }
        # Remove None values
        history_item = {k: v for k, v in history_item.items() if v is not None}
        
        try:
            history_table.put_item(
                Item=history_item,
                ConditionExpression="attribute_not_exists(#ts)",
                ExpressionAttributeNames={"#ts": "timestamp"},
            )
            logger.info(
                "History entry saved: %s at %s",
                history_item["space_id"],
                history_item["timestamp"],
            )
        except Exception as exc:
            if "ConditionalCheckFailedException" in str(exc):
                # Duplicate timestamp, ignore or log warning
                logger.warning("Duplicate history entry skipped: %s", history_item["space_id"])
                continue
            logger.error("History save error: %s", exc)


def current_occupancy(table) -> Tuple[int, int]:
    occupied = 0
    total = 0
    exclusive_start_key = None
    while True:
        scan_kwargs = {
            "ProjectionExpression": "space_id, #status",
            "ExpressionAttributeNames": {"#status": "status"},
        }
        if exclusive_start_key:
            scan_kwargs["ExclusiveStartKey"] = exclusive_start_key

        response = table.scan(**scan_kwargs)
        for item in response.get("Items", []):
            total += 1
            if item.get("status") == "occupied":
                occupied += 1

        exclusive_start_key = response.get("LastEvaluatedKey")
        if not exclusive_start_key:
            break

    return occupied, total
