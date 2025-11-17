"""Alert generation and dispatch for ingest_status."""

from __future__ import annotations

from typing import Dict, Iterable, List, Tuple

import json
import logging

logger = logging.getLogger(__name__)


def generate_alerts(items: Iterable[Dict], occupancy_stats: Tuple[int, int] | None) -> List[Dict]:
    alerts: List[Dict] = []

    for item in items:
        confidence = float(item["confidence"])
        if confidence < 0.8:
            alerts.append(
                {
                    "type": "LOW_CONFIDENCE",
                    "severity": "WARNING",
                    "space_id": item["space_id"],
                    "message": f"Low confidence {item['space_id']}: {confidence:.2f}",
                }
            )

    if occupancy_stats:
        occupied, total = occupancy_stats
        occupancy = occupied / total if total else 0
        if occupancy >= 0.95:
            alerts.append(
                {
                    "type": "CRITICAL",
                    "severity": "CRITICAL",
                    "message": f"{occupancy * 100:.0f}% full",
                }
            )
        elif occupancy >= 0.80:
            alerts.append(
                {
                    "type": "HIGH",
                    "severity": "WARNING",
                    "message": f"{occupancy * 100:.0f}% full",
                }
            )

    return alerts


def send_alert(queue_url: str | None, alert: Dict, sqs_client) -> bool:
    if not queue_url:
        logger.warning("SQS URL missing for alert %s", alert)
        return False
    try:
        response = sqs_client.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(alert),
            MessageAttributes={
                "AlertType": {"StringValue": alert.get("type", "UNKNOWN"), "DataType": "String"},
                "Severity": {"StringValue": alert.get("severity", "INFO"), "DataType": "String"},
            },
        )
        logger.info("SQS message sent: %s", response["MessageId"])
        return True
    except Exception as exc:  # pragma: no cover
        logger.error("SQS send failed: %s", exc)
        return False


def dispatch_alerts(alerts: Iterable[Dict], sqs_client, low_conf_queue: str | None, alerts_queue: str | None) -> None:
    for alert in alerts:
        if alert.get("type") == "LOW_CONFIDENCE":
            send_alert(low_conf_queue, alert, sqs_client)
        else:
            send_alert(alerts_queue, alert, sqs_client)
