"""Configuration and ROI loading helpers for the edge publisher."""

import json
import logging
import os
import sys
from typing import List, Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError


logger = logging.getLogger(__name__)


def load_config_from_env():
    """Load configuration from environment variables with validation."""
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

    for key in ["cert_path", "key_path", "ca_path"]:
        if not os.path.isfile(config[key]):
            logger.error("Certificate not found: %s", config[key])
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


def _extract_roi_spaces(config_payload):
    if isinstance(config_payload, dict):
        spaces = config_payload.get("spaces")
    elif isinstance(config_payload, list):
        spaces = config_payload
    else:
        spaces = None

    if isinstance(spaces, list) and spaces:
        return spaces

    raise ValueError(
        "ROI configuration must include a non-empty 'spaces' list with polygons"
    )


def _load_roi_config_from_file(path):
    with open(path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return _extract_roi_spaces(payload)


def _load_roi_config_from_s3(bucket, key, region=None):
    client = boto3.client("s3", region_name=region)
    response = client.get_object(Bucket=bucket, Key=key)
    body = response["Body"].read().decode("utf-8")
    payload = json.loads(body)
    return _extract_roi_spaces(payload)


def resolve_roi_spaces(args) -> Optional[List[dict]]:
    if args.roi_config:
        try:
            spaces = _load_roi_config_from_file(args.roi_config)
            logger.info("Loaded ROI config from %s", args.roi_config)
            return spaces
        except (OSError, ValueError, json.JSONDecodeError) as exc:
            logger.error("Failed to load ROI config file: %s", exc)
            sys.exit(1)

    if args.roi_s3_bucket and args.roi_s3_key:
        try:
            spaces = _load_roi_config_from_s3(
                args.roi_s3_bucket, args.roi_s3_key, region=args.roi_s3_region
            )
            logger.info(
                "Loaded ROI config from s3://%s/%s",
                args.roi_s3_bucket,
                args.roi_s3_key,
            )
            return spaces
        except (BotoCoreError, ClientError, ValueError, json.JSONDecodeError) as exc:
            logger.error("Failed to download ROI config from S3: %s", exc)
            sys.exit(1)

    return None
