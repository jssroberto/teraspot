"""AWS Lambda entry point for ingesting parking occupancy events."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List

import boto3

from parser import parse_events
from qa import enrich_event, validate_data
from persistence import save_current

logger = logging.getLogger()
logger.setLevel(logging.INFO)


REGION = os.getenv("REGION", "us-east-1")
DYNAMODB_TABLE = os.getenv("DYNAMODB_TABLE", "parking-spaces-dev")
HISTORY_TABLE = os.getenv("HISTORY_TABLE", "parking-history")
SQS_ALERTS_URL = os.getenv("SQS_ALERTS_URL")
SQS_LOW_CONFIDENCE_URL = os.getenv("SQS_LOW_CONFIDENCE_URL")

dynamodb = boto3.resource("dynamodb", region_name=REGION)
sqs = boto3.client("sqs", region_name=REGION)

current_table = dynamodb.Table(DYNAMODB_TABLE)
history_table = dynamodb.Table(HISTORY_TABLE)


def _extract_raw_payload(event: Any) -> Any:
    if isinstance(event, dict) and "body" in event:
        return event["body"]
    return event


def lambda_handler(event, context):
    try:
        logger.info("ingest_status triggered")
        raw_payload = _extract_raw_payload(event)
        events = parse_events(raw_payload)

        if not events:
            logger.error("Empty or invalid payload")
            return {"statusCode": 400, "body": json.dumps({"error": "No events"})}

        processed_count = 0
        rejected_count = 0
        history_writes = 0

        for entry in events:
            enriched = enrich_event(entry)
            space_id = enriched.get("space_id")
            
            # 1. Validate
            if not space_id:
                logger.warning("Rejected event without space_id: %s", entry)
                rejected_count += 1
                continue

            is_valid, error = validate_data(space_id, enriched)
            if not is_valid:
                logger.warning("Rejected %s: %s", space_id, error)
                rejected_count += 1
                continue

            # Construct the item (WITHOUT data_source/type)
            new_item = {
                "space_id": space_id,
                "status": enriched["status"],
                "confidence": Decimal(str(enriched["confidence"])),
                "timestamp": enriched["timestamp"],
                "device_id": enriched["device_id"],
                "facility_id": enriched["facility_id"],
                "zone_id": enriched["zone_id"],
                "is_alive": True,
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
                "processed_timestamp": datetime.now(timezone.utc).isoformat()
            }

            # 2. Fetch Current State
            from persistence import get_current_state
            current_state = get_current_state(space_id, current_table)
            
            # 3. Compare & Decide
            should_write_history = False
            
            if not current_state:
                # New space -> Write history
                should_write_history = True
                logger.info("New space detected: %s", space_id)
            else:
                old_status = current_state.get("status")
                was_alive = current_state.get("is_alive", True) # Default to True if missing
                
                if new_item["status"] != old_status:
                    should_write_history = True
                    logger.info("Status change: %s -> %s", old_status, new_item["status"])
                elif not was_alive:
                    should_write_history = True
                    logger.info("Device recovered: %s", space_id)
            
            # 4. Write History (if needed)
            if should_write_history:
                from persistence import save_history
                save_history([new_item], history_table)
                history_writes += 1

            # 5. Update Current (Always, for heartbeat)
            save_current([new_item], current_table)
            
            # 6. Calculate & Publish Latency Metric
            try:
                ts_str = new_item.get('timestamp')
                if ts_str:
                    ts_str = ts_str.replace('Z', '+00:00')
                    event_time = datetime.fromisoformat(ts_str)
                    now = datetime.now(timezone.utc)
                    latency = (now - event_time).total_seconds()
                    
                    if latency >= 0:
                        cloudwatch = boto3.client('cloudwatch', region_name=REGION)
                        cloudwatch.put_metric_data(
                            Namespace='TeraSpot/KPIs',
                            MetricData=[
                                {
                                    'MetricName': 'MessageProcessingLatency',
                                    'Dimensions': [
                                        {'Name': 'FacilityId', 'Value': new_item.get('facility_id', 'unknown')}
                                    ],
                                    'Value': latency,
                                    'Unit': 'Seconds',
                                    'StorageResolution': 60
                                }
                            ]
                        )
                        logger.info(f"Latency recorded: {latency:.3f}s")
            except Exception as e:
                logger.error(f"Error publishing latency metric: {e}")

            processed_count += 1

        logger.info(
            "Complete: %d processed, %d rejected, %d history entries",
            processed_count,
            rejected_count,
            history_writes
        )

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "success": True,
                    "processed": processed_count,
                    "rejected": rejected_count,
                    "history_writes": history_writes
                }
            ),
        }

    except Exception as exc: 
        logger.error("Unhandled error: %s", exc, exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(exc)})}
