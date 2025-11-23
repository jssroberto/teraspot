"""Publisher helpers: mocked data, state tracking, payload building."""

import json
import logging
import random
import time
from datetime import UTC, datetime

from awscrt import mqtt


logger = logging.getLogger(__name__)


def generate_mocked_spaces(count=30):
    """Generate mocked parking spaces with realistic confidence distribution."""
    spaces = {}
    occupied_count = 0

    confidence_distribution = {
        "high": (0.90, 1.00, 0.7),
        "medium": (0.70, 0.89, 0.2),
        "low": (0.40, 0.69, 0.1),
    }

    for i in range(1, count + 1):
        space_id = f"A-{i:02d}"
        is_occupied = random.random() < 0.6

        rand = random.random()
        cumulative = 0
        confidence_level = "high"

        for level, (min_conf, max_conf, prob) in confidence_distribution.items():
            cumulative += prob
            if rand <= cumulative:
                min_conf, max_conf, _ = confidence_distribution[level]
                confidence = round(min_conf + random.random() * (max_conf - min_conf), 3)
                break

        spaces[space_id] = {
            "status": "occupied" if is_occupied else "vacant",
            "confidence": confidence,
            "confidence_level": confidence_level,
        }

        if is_occupied:
            occupied_count += 1

    return {
        "spaces": spaces,
        "total_occupied": occupied_count,
        "total_vacant": count - occupied_count,
    }


class SpaceStateTracker:
    """In-memory cache to compute per-space state changes."""

    def __init__(self):
        self._last_states = {}

    def detect_changes(self, current_spaces):
        changes = []
        for space_id, data in current_spaces.items():
            status = data.get("status")
            prev = self._last_states.get(space_id)
            if not prev or prev.get("status") != status:
                changes.append(
                    {
                        "space_id": space_id,
                        "status": status,
                        "confidence": data.get("confidence"),
                    }
                )
            self._last_states[space_id] = {
                "status": status,
                "confidence": data.get("confidence"),
            }
        return changes


def build_change_payload(changes, metadata):
    timestamp = datetime.now(UTC).isoformat()
    enriched = []
    for change in changes:
        enriched.append(
            {
                "space_id": change["space_id"],
                "status": change["status"],
                "confidence": change.get("confidence"),
                "timestamp": timestamp,
                "device_id": metadata["device_id"],
                "facility_id": metadata["facility_id"],
                "zone_id": metadata["zone_id"],
                "data_source": metadata["data_source"],
            }
        )
    return enriched


def publish_change_events(mqtt_connection, topic, events):
    logger.info(
        "\nPublishing %d state change event(s) to topic: %s",
        len(events),
        topic,
    )
    mqtt_connection.publish(
        topic=topic, payload=json.dumps(events), qos=mqtt.QoS.AT_LEAST_ONCE
    )
    logger.info("   Message published successfully!")


def wait_interval(seconds):
    if seconds > 0:
        logger.info("\nWaiting %d seconds before next message...", seconds)
        time.sleep(seconds)
