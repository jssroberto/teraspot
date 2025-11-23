#!/usr/bin/env python3
"""
TeraSpot Edge Publisher
Publishes parking occupancy data from edge device to AWS IoT Core
Supports both mocked data and real YOLO inference
"""

from awsiot import mqtt_connection_builder
import argparse
import logging
import sys
import time

from config_utils import load_config_from_env, resolve_roi_spaces
from publisher_utils import (
    SpaceStateTracker,
    build_change_payload,
    generate_mocked_spaces,
    publish_change_events,
    wait_interval,
)

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
    parser.add_argument(
        "--roi-config",
        default=None,
        help="Path to parking ROI JSON configuration",
    )
    parser.add_argument(
        "--roi-s3-bucket",
        default=None,
        help="S3 bucket containing ROI config (alternative to --roi-config)",
    )
    parser.add_argument(
        "--roi-s3-key",
        default=None,
        help="S3 object key for ROI config",
    )
    parser.add_argument(
        "--roi-s3-region",
        default=None,
        help="Optional AWS region for ROI S3 bucket",
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
    roi_spaces = None
    if args.use_yolo:
        roi_spaces = resolve_roi_spaces(args)
        if not roi_spaces:
            logger.error(
                "ROI configuration is required when running YOLO inference. "
                "Provide --roi-config or --roi-s3-bucket/--roi-s3-key."
            )
            sys.exit(1)

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

            if roi_spaces:
                yolo.set_roi_spaces(roi_spaces)
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
    if roi_spaces:
        logger.info(f" ROI Spaces Loaded: {len(roi_spaces)}")
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
