#!/usr/bin/env python3
"""
TeraSpot Edge Publisher
Publishes parking occupancy data from edge device to AWS IoT Core
Supports both mocked data and real YOLO inference
"""

from awscrt import mqtt
from awsiot import mqtt_connection_builder
import json
import os
import sys
from datetime import datetime, UTC
import time
import argparse
import logging
import random

# Import YOLO processor (if using real inference)
try:
    from yolo_processor import YOLOProcessor

    YOLO_AVAILABLE = True
except ImportError as e:
    logging.warning(f"YOLO processor not available: {e}")
    YOLO_AVAILABLE = False

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def load_config_from_env():
    """Load configuration from environment variables with validation"""
    base_cert_path = os.getenv("AWS_IOT_CERT_PATH", "./certs")
    facility_id = os.getenv("AWS_IOT_FACILITY_ID")
    zone_id = os.getenv("AWS_IOT_ZONE_ID")

    config = {
        "endpoint": os.getenv("AWS_IOT_ENDPOINT"),
        "cert_path": os.path.join(base_cert_path, "device-certificate.pem.crt"),
        "key_path": os.path.join(base_cert_path, "private-key.pem.key"),
        "ca_path": os.path.join(base_cert_path, "AmazonRootCA1.pem"),
        "thing_name": os.getenv("AWS_IOT_THING_NAME", "teraspot-edge-device"),
        "facility_id": facility_id,
        "zone_id": zone_id,
    }

    # Validate required parameters
    missing = [
        key
        for key, value in (
            ("AWS_IOT_ENDPOINT", config["endpoint"]),
            ("AWS_IOT_FACILITY_ID", facility_id),
            ("AWS_IOT_ZONE_ID", zone_id),
        )
        if not value
    ]
    if missing:
        logger.error("Missing required environment variables: %s", ", ".join(missing))
        sys.exit(1)

    # Validate certificates exist
    for key in ["cert_path", "key_path", "ca_path"]:
        if not os.path.isfile(config[key]):
            logger.error(f"Certificate not found: {config[key]}")
            sys.exit(1)

    topic_override = os.getenv("AWS_IOT_TOPIC")
    if topic_override:
        config["topic"] = topic_override
    else:
        config["topic"] = (
            f"teraspot/{config['facility_id']}/{config['zone_id']}/"
            f"{config['thing_name']}/status"
        )

    logger.info("Configuration loaded from environment")
    logger.info(f"   Endpoint: {config['endpoint']}")
    logger.info(f"   Thing Name: {config['thing_name']}")
    logger.info(f"   Facility: {config['facility_id']}")
    logger.info(f"   Zone: {config['zone_id']}")
    logger.info(f"   Topic: {config['topic']}")

    return config


def on_connection_success(connection, callback_data):
    """Callback when connection succeeds"""
    logger.info("Successfully connected to AWS IoT Core!")


def on_connection_failure(connection, callback_data):
    """Callback when connection fails"""
    logger.error("Failed to connect to AWS IoT Core")
    logger.error(f"   Error: {callback_data}")


def on_connection_closed(connection, callback_data):
    """Callback when connection closes"""
    logger.info("Connection closed")


def generate_mocked_spaces(count=30):
    """
    Generate mocked parking spaces with realistic confidence distribution

    Args:
        count: Number of parking spaces to generate

    Returns:
        Dictionary with spaces, total_occupied, and total_vacant
    """
    spaces = {}
    occupied_count = 0

    # Confidence distribution: 70% high confidence, 20% medium confidence, 10% low confidence
    confidence_distribution = {
        "high": (0.90, 1.00, 0.7),  # (min, max, probability)
        "medium": (0.70, 0.89, 0.2),
        "low": (0.40, 0.69, 0.1),
    }

    # Simulate realistic parking pattern: ~60% occupied
    for i in range(1, count + 1):
        space_id = f"A-{i:02d}"
        is_occupied = random.random() < 0.6

        # Determine confidence level based on distribution
        rand = random.random()
        cumulative = 0
        confidence_level = "high"

        for level, (min_conf, max_conf, prob) in confidence_distribution.items():
            cumulative += prob
            if rand <= cumulative:
                confidence_level = level
                min_conf, max_conf, _ = confidence_distribution[level]
                confidence = round(
                    min_conf + random.random() * (max_conf - min_conf), 3
                )
                break

        spaces[space_id] = {
            "status": "occupied" if is_occupied else "vacant",
            "confidence": confidence,
            "confidence_level": confidence_level,  # Added for clarity
        }

        if is_occupied:
            occupied_count += 1

    return {
        "spaces": spaces,
        "total_occupied": occupied_count,
        "total_vacant": count - occupied_count,
    }


class SpaceStateTracker:
    """In-memory cache to compute per-space state changes"""

    def __init__(self):
        self._last_states = {}

    def detect_changes(self, current_spaces):
        """Return list of spaces whose status changed since last snapshot"""
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
            # Always update the cache with latest values
            self._last_states[space_id] = {
                "status": status,
                "confidence": data.get("confidence"),
            }
        return changes


def build_change_payload(changes, metadata):
    """Attach metadata (device/facility/zone/timestamp) to change events"""
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
    """Publish per-space change events to MQTT"""
    logger.info(
        "\nPublishing %d state change event(s) to topic: %s",
        len(events),
        topic,
    )
    mqtt_connection.publish(
        topic=topic, payload=json.dumps(events), qos=mqtt.QoS.AT_LEAST_ONCE
    )
    logger.info("   Message published successfully!")


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="TeraSpot Edge Publisher")

    # YOLO arguments
    parser.add_argument(
        "--use-yolo",
        action="store_true",
        help="Use YOLO inference instead of mocked data",
    )
    parser.add_argument(
        "--image",
        default="assets/bus.jpg",
        help="Image path for YOLO inference (default: assets/bus.jpg)",
    )
    parser.add_argument(
        "--video",
        default=None,
        help="Video path for YOLO inference (takes precedence over --image)",
    )
    parser.add_argument(
        "--model",
        default="models/yolo11n.pt",
        help="YOLO model path (default: models/yolo11n.pt)",
    )
    parser.add_argument(
        "--frame-skip",
        type=int,
        default=0,
        help="Number of frames to skip between video inferences (default: 0)",
    )

    # Publisher arguments
    parser.add_argument(
        "--spaces", type=int, default=30, help="Number of parking spaces (default: 30)"
    )
    parser.add_argument(
        "--device-id", default="teraspot-edge-device", help="Device identifier"
    )
    parser.add_argument(
        "--iterations",
        type=int,
        default=-1,
        help="Number of messages to publish (-1 = infinite)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=5,
        help="Interval between messages in seconds (default: 5)",
    )

    args = parser.parse_args()

    # Load configuration from environment
    config = load_config_from_env()

    change_tracker = SpaceStateTracker()

    # Initialize YOLO if requested
    yolo = None
    if args.use_yolo:
        if not YOLO_AVAILABLE:
            logger.error(
                "YOLO processor not available. Install ultralytics or disable --use-yolo"
            )
            sys.exit(1)

        try:
            yolo = YOLOProcessor(args.model, frame_skip=args.frame_skip)
            if args.video:
                yolo.set_video(args.video)
                logger.info(f"YOLO mode enabled with video: {args.video}")
            else:
                yolo.set_image(args.image)
                logger.info(f"YOLO mode enabled with image: {args.image}")
        except Exception as e:
            logger.error(f"Failed to initialize YOLO: {e}")
            sys.exit(1)

    logger.info("=" * 60)
    logger.info(" TERASPOT EDGE PUBLISHER")
    logger.info("=" * 60)
    logger.info(f" Endpoint: {config['endpoint']}")
    logger.info(f" Thing Name: {config['thing_name']}")
    logger.info(f" Spaces: {args.spaces}")
    logger.info(f" Mode: {'YOLO INFERENCE' if args.use_yolo else 'MOCKED DATA'}")
    logger.info(
        f" Iterations: {args.iterations if args.iterations > 0 else 'INFINITE'}"
    )
    logger.info(f" Interval: {args.interval}s")
    logger.info("=" * 60)

    try:
        # Create MQTT connection
        logger.info("\nConnecting to AWS IoT Core...")
        mqtt_connection = mqtt_connection_builder.mtls_from_path(
            endpoint=config["endpoint"],
            cert_filepath=config["cert_path"],
            pri_key_filepath=config["key_path"],
            ca_filepath=config["ca_path"],
            client_id=config["thing_name"],
            clean_session=False,
            keep_alive_secs=30,
            on_connection_success=on_connection_success,
            on_connection_failure=on_connection_failure,
            on_connection_closed=on_connection_closed,
        )

        # Connect
        connect_future = mqtt_connection.connect()
        connect_future.result()

        # Publish messages
        iteration = 0
        while args.iterations < 0 or iteration < args.iterations:
            if iteration > 0:
                logger.info(
                    f"\nWaiting {args.interval} seconds before next message..."
                )
                time.sleep(args.interval)

            logger.info(f"\nMessage {iteration + 1}")

            # Generate snapshot
            data_source = "yolo11n" if yolo else "mocked"
            if yolo:
                snapshot = yolo.detect_parking_spaces(total_spaces=args.spaces)
            else:
                snapshot = generate_mocked_spaces(args.spaces)

            spaces = snapshot["spaces"]
            data_metadata = {
                "device_id": args.device_id,
                "facility_id": config["facility_id"],
                "zone_id": config["zone_id"],
                "data_source": data_source,
            }

            changes = change_tracker.detect_changes(spaces)
            if not changes:
                logger.info("   No state changes detected; skipping publish")
                iteration += 1
                continue

            events_payload = build_change_payload(changes, data_metadata)

            logger.info(
                "   Occupied: %d | Vacant: %d | Source: %s",
                snapshot["total_occupied"],
                snapshot["total_vacant"],
                data_source,
            )
            if snapshot.get("detections_count") is not None:
                logger.info("   Detections: %d", snapshot["detections_count"])

            publish_change_events(mqtt_connection, config["topic"], events_payload)
            iteration += 1

        time.sleep(2)

        # Disconnect
        logger.info("\nDisconnecting...")
        disconnect_future = mqtt_connection.disconnect()
        disconnect_future.result()

        logger.info("=" * 60)
        logger.info(" PUBLISHER COMPLETED SUCCESSFULLY")
        logger.info("=" * 60)

    except KeyboardInterrupt:
        logger.info("\n\nInterrupted by user")
        mqtt_connection.disconnect()

    except Exception as e:
        logger.error(f"\nERROR: {str(e)}")
        logger.error("=" * 60)
        sys.exit(1)
    finally:
        if yolo:
            yolo.cleanup()


if __name__ == "__main__":
    main()
