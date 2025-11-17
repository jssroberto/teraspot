"""Payload normalization helpers for the ingest_status Lambda."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Dict, List


def _ensure_timestamp(value: str | None) -> str:
    if not value:
        return datetime.now(timezone.utc).isoformat()
    return value


def _legacy_spaces_to_events(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    events = []
    spaces = payload.get("spaces", {}) or {}
    timestamp = _ensure_timestamp(payload.get("timestamp"))
    device_id = payload.get("device_id")
    facility_id = payload.get("facility_id")
    zone_id = payload.get("zone_id")

    for space_id, data in spaces.items():
        event = {"space_id": space_id, **data}
        if "timestamp" not in event:
            event["timestamp"] = timestamp
        if device_id and "device_id" not in event:
            event["device_id"] = device_id
        if facility_id and "facility_id" not in event:
            event["facility_id"] = facility_id
        if zone_id and "zone_id" not in event:
            event["zone_id"] = zone_id
        events.append(event)

    return events


def parse_events(raw_event: Any) -> List[Dict[str, Any]]:
    """Normalize incoming payloads from IoT Core into per-space events."""
    if raw_event is None:
        return []

    if isinstance(raw_event, str):
        try:
            raw_event = json.loads(raw_event)
        except json.JSONDecodeError:
            return []

    if isinstance(raw_event, list):
        return raw_event

    if isinstance(raw_event, dict):
        if "events" in raw_event and isinstance(raw_event["events"], list):
            return raw_event["events"]
        if "spaces" in raw_event:
            return _legacy_spaces_to_events(raw_event)
        if "space_id" in raw_event:
            payload = raw_event.copy()
            if "timestamp" not in payload:
                payload["timestamp"] = _ensure_timestamp(None)
            return [payload]

    return []

