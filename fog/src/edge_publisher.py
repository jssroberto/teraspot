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
    config = {
        "endpoint": os.getenv("AWS_IOT_ENDPOINT"),
        "cert_path": os.getenv("AWS_IOT_CERT_PATH", "./certs")
        + "/device-certificate.pem.crt",
        "key_path": os.getenv("AWS_IOT_CERT_PATH", "./certs") + "/private-key.pem.key",
        "ca_path": os.getenv("AWS_IOT_CERT_PATH", "./certs") + "/AmazonRootCA1.pem",
        "thing_name": os.getenv("AWS_IOT_THING_NAME", "teraspot-edge-device"),
        "topic": os.getenv("AWS_IOT_TOPIC", "teraspot/parking/status"),
    }

    # Validate endpoint
    if not config["endpoint"]:
        logger.error("AWS_IOT_ENDPOINT not set")
        sys.exit(1)

    # Validate certificates exist
    for key in ["cert_path", "key_path", "ca_path"]:
        if not os.path.isfile(config[key]):
            logger.error(f"Certificate not found: {config[key]}")
            sys.exit(1)

    logger.info("Configuration loaded from environment")
    logger.info(f"   Endpoint: {config['endpoint']}")
    logger.info(f"   Thing Name: {config['thing_name']}")
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


def create_payload(device_id, num_spaces=30, data_source="mocked", extra_data=None):
    """
    Create MQTT message payload

    Args:
        device_id: Unique device identifier
        num_spaces: Number of parking spaces
        data_source: Source of data (mocked, yolo11n, etc.)
        extra_data: Additional data from YOLO (detections, etc.)

    Returns:
        JSON payload as dictionary
    """
    payload = {
        "timestamp": datetime.now(UTC).isoformat(),
        "device_id": device_id,
        "data_source": data_source,
    }

    # Add extra YOLO data if available
    if extra_data:
        payload.update(extra_data)
    else:
        # Generate mocked data
        mocked = generate_mocked_spaces(num_spaces)
        payload.update(
            {
                "spaces": mocked["spaces"],
                "total_occupied": mocked["total_occupied"],
                "total_vacant": mocked["total_vacant"],
            }
        )

    return payload


def publish_message(mqtt_connection, topic, payload, verbose=True):
    """
    Publish message to MQTT topic

    Args:
        mqtt_connection: Active MQTT connection
        topic: MQTT topic to publish to
        payload: Dictionary to publish as JSON
        verbose: If True, print message details
    """
    if verbose:
        total_spaces = payload["total_occupied"] + payload["total_vacant"]
        occupancy_rate = (
            payload["total_occupied"] / total_spaces * 100 if total_spaces > 0 else 0
        )

        # Count low-confidence detections
        low_confidence_count = 0
        if "spaces" in payload:
            for space in payload["spaces"].values():
                if space.get("confidence", 1.0) < 0.70:
                    low_confidence_count += 1

        logger.info(f"\nPublishing to topic: {topic}")
        logger.info(
            f"   Occupied: {payload['total_occupied']} | "
            f"Vacant: {payload['total_vacant']} | "
            f"Rate: {occupancy_rate:.1f}% | "
            f"Source: {payload['data_source']}"
        )

        if low_confidence_count > 0:
            logger.info(f"   Low Confidence Detections: {low_confidence_count}")

        if "detections_count" in payload:
            logger.info(f"   Detections: {payload['detections_count']}")

    mqtt_connection.publish(
        topic=topic, payload=json.dumps(payload), qos=mqtt.QoS.AT_LEAST_ONCE
    )

    if verbose:
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
        "--model",
        default="models/yolo11n.pt",
        help="YOLO model path (default: models/yolo11n.pt)",
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

    # Initialize YOLO if requested
    yolo = None
    if args.use_yolo:
        if not YOLO_AVAILABLE:
            logger.error(
                "YOLO processor not available. Install ultralytics or disable --use-yolo"
            )
            sys.exit(1)

        try:
            yolo = YOLOProcessor(args.model)
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

            # Generate payload
            if yolo:
                # Use YOLO inference
                yolo_data = yolo.detect_parking_spaces(total_spaces=args.spaces)
                payload = create_payload(
                    device_id=args.device_id,
                    data_source="yolo11n",
                    extra_data={
                        "spaces": yolo_data["spaces"],
                        "total_occupied": yolo_data["total_occupied"],
                        "total_vacant": yolo_data["total_vacant"],
                        "detections_count": yolo_data["detections_count"],
                        "vehicle_count": yolo_data["vehicle_count"],
                    },
                )
            else:
                # Use mocked data
                payload = create_payload(
                    device_id=args.device_id,
                    num_spaces=args.spaces,
                    data_source="mocked",
                )

            # Publish
            publish_message(mqtt_connection, config["topic"], payload)
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


if __name__ == "__main__":
    main()
