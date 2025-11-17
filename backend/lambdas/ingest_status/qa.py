"""Validation helpers for the ingest_status Lambda."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Tuple

import logging

logger = logging.getLogger(__name__)


def _parse_timestamp(value: str | None) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    # Accept timestamps with or without timezone suffix
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value
    except Exception:
        raise ValueError("Invalid timestamp")


def validate_data(space_id: str, data: Dict[str, Any]) -> Tuple[bool, str]:
    """Validate a normalized space event."""
    if not isinstance(space_id, str) or not space_id:
        return False, "Missing space_id"

    confidence = data.get("confidence")
    if not isinstance(confidence, (int, float)):
        return False, "Invalid confidence type"
    confidence_value = float(confidence)
    if not 0 <= confidence_value <= 1:
        return False, f"Confidence out of range: {confidence_value}"

    status = str(data.get("status", "")).lower()
    if status not in {"occupied", "vacant"}:
        return False, f"Invalid status: {status}"

    timestamp = data.get("timestamp")
    try:
        _parse_timestamp(timestamp)
    except ValueError:
        return False, "Invalid timestamp"

    if confidence_value < 0.8:
        logger.warning("Low confidence detected: %s = %.2f", space_id, confidence_value)

    return True, ""


def enrich_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure required fields exist with defaults."""
    event = event.copy()
    event.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
    event.setdefault("device_id", "unknown")
    event.setdefault("facility_id", "unknown")
    event.setdefault("zone_id", "unknown")
    event.setdefault("data_source", "unknown")
    return event
