import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, Tuple

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME", "teraspot-config-dev")

s3_client = boto3.client("s3", region_name=AWS_REGION)


def validate_config(config: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Validates that the configuration meets the required schema.
    """
    # Required fields
    required_fields = ["config_id", "config_type", "value"]
    for field in required_fields:
        if field not in config:
            return False, f"Missing required field: {field}"

    # Valid types
    valid_types = ["threshold", "zone", "device", "alert_rule"]
    if config.get("config_type") not in valid_types:
        return False, f"Invalid config_type. Must be one of: {valid_types}"

    # Validate by type
    config_type = config.get("config_type")

    if config_type == "threshold":
        # Thresholds must have numbers
        value = config.get("value", {})
        if not isinstance(value, dict):
            return False, "threshold value must be a dict with numeric values"

    elif config_type == "zone":
        # Zones must have name and total spaces
        value = config.get("value", {})
        if "name" not in value or "total_spaces" not in value:
            return False, "zone must have 'name' and 'total_spaces'"

    elif config_type == "device":
        # Devices must have ip and port
        value = config.get("value", {})
        if "ip" not in value or "port" not in value:
            return False, "device must have 'ip' and 'port'"

    return True, ""


def save_config(config: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Saves configuration to S3.
    """
    try:
        # Validate
        is_valid, error_msg = validate_config(config)
        if not is_valid:
            logger.warning(f"Config validation failed: {error_msg}")
            return False, error_msg

        config_id = config.get("config_id")

        # Build item with metadata
        item = config.copy()
        item.update(
            {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "version": config.get("version", 1),
                "updated_by": config.get("updated_by", "system"),
                "active": config.get("active", True),
            }
        )

        key = f"configs/{config_id}.json"

        # Save to S3
        s3_client.put_object(
            Bucket=CONFIG_BUCKET_NAME,
            Key=key,
            Body=json.dumps(item, indent=2),
            ContentType="application/json",
        )
        logger.info(f"Saved config: {config_id} to s3://{CONFIG_BUCKET_NAME}/{key}")

        return True, f"Config {config_id} saved successfully"

    except Exception as e:
        logger.error(f"Failed to save config: {str(e)}")
        return False, str(e)


def get_config(config_id: str) -> Dict[str, Any]:
    """
    Gets configuration by ID from S3.
    """
    try:
        key = f"configs/{config_id}.json"
        response = s3_client.get_object(Bucket=CONFIG_BUCKET_NAME, Key=key)
        content = response["Body"].read().decode("utf-8")
        return json.loads(content)
    except s3_client.exceptions.NoSuchKey:
        logger.warning(f"Config not found: {config_id}")
        return {}
    except Exception as e:
        logger.error(f"Failed to get config {config_id}: {str(e)}")
        return {}


def get_configs_by_type(config_type: str) -> list:
    """
    Gets all configurations of a specific type.
    """
    try:
        # List all objects in configs/
        response = s3_client.list_objects_v2(
            Bucket=CONFIG_BUCKET_NAME, Prefix="configs/"
        )

        if "Contents" not in response:
            return []

        configs = []
        for obj in response["Contents"]:
            key = obj["Key"]
            if not key.endswith(".json"):
                continue

            try:
                # Read each config to verify the type
                # Note: This is not efficient for thousands of files, but acceptable for configs
                obj_resp = s3_client.get_object(Bucket=CONFIG_BUCKET_NAME, Key=key)
                content = obj_resp["Body"].read().decode("utf-8")
                config = json.loads(content)

                if config.get("config_type") == config_type:
                    configs.append(config)
            except Exception as e:
                logger.warning(f"Failed to read config {key}: {str(e)}")
                continue

        return configs
    except Exception as e:
        logger.error(f"Failed to get configs by type {config_type}: {str(e)}")
        return []


def lambda_handler(event, context):
    """
    Handles configuration CRUD.
    Actions: SAVE, GET, LIST, DELETE
    """
    try:
        logger.info("config_saver triggered")

        # Parse payload
        if "body" in event:
            payload = (
                json.loads(event["body"])
                if isinstance(event["body"], str)
                else event["body"]
            )
        else:
            payload = event

        action = payload.get("action", "SAVE").upper()

        # SAVE: Save new configuration
        if action == "SAVE":
            config = payload.get("config", {})
            success, message = save_config(config)

            return {
                "statusCode": 200 if success else 400,
                "body": json.dumps(
                    {
                        "message": message,
                        "config_id": config.get("config_id"),
                        "success": success,
                    }
                ),
            }

        # GET: Get configuration by ID
        elif action == "GET":
            config_id = payload.get("config_id")
            if not config_id:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "config_id required"}),
                }

            config = get_config(config_id)
            return {
                "statusCode": 200,
                "body": json.dumps({"config": config}, default=str),
            }

        # LIST: List by type
        elif action == "LIST":
            config_type = payload.get("config_type")
            if not config_type:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "config_type required"}),
                }

            configs = get_configs_by_type(config_type)
            return {
                "statusCode": 200,
                "body": json.dumps(
                    {
                        "config_type": config_type,
                        "count": len(configs),
                        "items": configs,
                    },
                    default=str,
                ),
            }

        else:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": f"Unknown action: {action}"}),
            }

    except Exception as e:
        logger.error(f"Error in config_saver: {str(e)}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
