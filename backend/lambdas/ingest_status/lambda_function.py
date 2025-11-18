"""AWS Lambda entry point for ingesting parking occupancy events."""

from __future__ import annotations

import json
import logging
import os
from decimal import Decimal
from typing import Any, Dict, List

import boto3

from .parser import parse_events
from .qa import enrich_event, validate_data
from .persistence import current_occupancy, save_current, save_history
from .alerts import generate_alerts, dispatch_alerts

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

        items: List[Dict[str, Any]] = []
        rejected = 0

        for entry in events:
            enriched = enrich_event(entry)
            space_id = enriched.get("space_id")
            if not space_id:
                logger.warning("Rejected event without space_id: %s", entry)
                rejected += 1
                continue

            is_valid, error = validate_data(space_id, enriched)
            if not is_valid:
                logger.warning("Rejected %s: %s", space_id, error)
                rejected += 1
                continue

            items.append(
                {
                    "space_id": space_id,
                    "status": enriched["status"],
                    "confidence": Decimal(str(enriched["confidence"])),
                    "timestamp": enriched["timestamp"],
                    "device_id": enriched["device_id"],
                    "facility_id": enriched["facility_id"],
                    "zone_id": enriched["zone_id"],
                    "data_source": enriched.get("data_source", "unknown"),
                }
            )

        if not items:
            logger.error("No valid items (rejected: %d)", rejected)
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "No items", "rejected": rejected}),
            }

        logger.info("Saving current data")
        save_current(items, current_table)

        logger.info("Saving historical data")
        save_history(items, history_table)

        logger.info("Computing occupancy")
        occupancy_stats = current_occupancy(current_table)

        logger.info("Generating alerts")
        alerts = generate_alerts(items, occupancy_stats)

        logger.info("Sending alerts to SQS")
        dispatch_alerts(alerts, sqs, SQS_LOW_CONFIDENCE_URL, SQS_ALERTS_URL)

        logger.info(
            "Complete: %d items, %d alerts, %d rejected",
            len(items),
            len(alerts),
            rejected,
        )

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "success": True,
                    "items": len(items),
                    "alerts": len(alerts),
                    "rejected": rejected,
                }
            ),
        }

    except Exception as exc:  # pragma: no cover - defensive
        logger.error("Unhandled error: %s", exc, exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(exc)})}
