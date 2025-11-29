import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME", "teraspot-config-dev")

s3_client = boto3.client("s3", region_name=AWS_REGION)


def _validate_threshold(config: dict[str, Any]) -> tuple[bool, str]:
    if "threshold_id" not in config:
        return False, "threshold must have 'threshold_id'"
    value = config.get("value", {})
    if not isinstance(value, dict):
        return False, "threshold value must be a dict with numeric values"
    return True, ""


def _validate_zone(config: dict[str, Any]) -> tuple[bool, str]:
    if "facility_id" not in config or "zone_id" not in config:
        return False, "zone must have 'facility_id' and 'zone_id'"
    value = config.get("value", {})
    if "name" not in value or "total_spaces" not in value:
        return False, "zone value must have 'name' and 'total_spaces'"
    return True, ""


def _validate_device(config: dict[str, Any]) -> tuple[bool, str]:
    if "device_id" not in config:
        return False, "device must have 'device_id'"
    value = config.get("value", {})
    if "ip" not in value or "port" not in value:
        return False, "device value must have 'ip' and 'port'"
    return True, ""


def _validate_alert_rule(config: dict[str, Any]) -> tuple[bool, str]:
    if "rule_id" not in config:
        return False, "alert_rule must have 'rule_id'"
    return True, ""


def _validate_roi(config: dict[str, Any]) -> tuple[bool, str]:
    if "device_id" not in config:
        return False, "roi must have 'device_id'"
    spaces = config.get("value", {}).get("spaces")
    if not isinstance(spaces, list):
        return False, "roi value must have 'spaces' list"
    for space in spaces:
        if "space_id" not in space or "polygon" not in space:
            return False, "each space must have 'space_id' and 'polygon'"
    return True, ""


def validate_config(config: dict[str, Any]) -> tuple[bool, str]:
    """
    Validates that the configuration meets the required schema.
    """
    # Required fields
    required_fields = ["config_type", "value"]
    for field in required_fields:
        if field not in config:
            return False, f"Missing required field: {field}"

    # Valid types
    valid_types = ["threshold", "zone", "device", "alert_rule", "roi"]
    config_type = config.get("config_type")
    if config_type not in valid_types:
        return False, f"Invalid config_type. Must be one of: {valid_types}"

    # Validate by type
    if config_type == "threshold":
        return _validate_threshold(config)
    elif config_type == "zone":
        return _validate_zone(config)
    elif config_type == "device":
        return _validate_device(config)
    elif config_type == "alert_rule":
        return _validate_alert_rule(config)
    elif config_type == "roi":
        return _validate_roi(config)

    return True, ""


def _generate_config_id(config: dict[str, Any]) -> str:
    """Generates a unique config ID based on the configuration type."""
    config_type = config.get("config_type")

    if config_type == "zone":
        return f"roi-{config['facility_id']}-{config['zone_id']}"
    elif config_type == "device":
        return f"device-{config['device_id']}"
    elif config_type == "threshold":
        return f"threshold-{config['threshold_id']}"
    elif config_type == "alert_rule":
        return f"alert-{config['rule_id']}"
    elif config_type == "roi":
        return f"roi-{config['device_id']}"

    return ""


def _prepare_config_item(config: dict[str, Any], config_id: str) -> dict[str, Any]:
    """Prepares the configuration item with metadata for storage."""
    item = config.copy()
    item.update(
        {
            "config_id": config_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "version": config.get("version", 1),
            "updated_by": config.get("updated_by", "system"),
            "active": config.get("active", True),
        }
    )
    return item


def _parse_payload(event: Any) -> dict[str, Any]:
    """Parses the Lambda event to extract the payload."""
    if "body" in event:
        return (
            json.loads(event["body"])
            if isinstance(event["body"], str)
            else event["body"]
        )
    return event


def save_config(config: dict[str, Any]) -> tuple[bool, str, str]:
    """
    Saves configuration to S3.
    Returns: (success, message, config_id)
    """
    try:
        # Validate
        is_valid, error_msg = validate_config(config)
        if not is_valid:
            logger.warning(f"Config validation failed: {error_msg}")
            return False, error_msg, ""

        # Generate config_id based on type
        config_id = _generate_config_id(config)

        # Build item with metadata
        item = _prepare_config_item(config, config_id)

        key = f"configs/{config_id}.json"

        # Save to S3
        s3_client.put_object(
            Bucket=CONFIG_BUCKET_NAME,
            Key=key,
            Body=json.dumps(item, indent=2),
            ContentType="application/json",
        )
        logger.info(f"Saved config: {config_id} to s3://{CONFIG_BUCKET_NAME}/{key}")

        return True, f"Config {config_id} saved successfully", config_id

    except Exception as e:
        logger.error(f"Failed to save config: {str(e)}")
        return False, str(e), ""


def get_config(config_id: str) -> dict[str, Any]:
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
            key = obj.get("Key")
            if not key or not key.endswith(".json"):
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


def _handle_save(payload: dict[str, Any]) -> dict[str, Any]:
    config = payload.get("config", {})
    success, message, config_id = save_config(config)

    return {
        "statusCode": 200 if success else 400,
        "body": json.dumps(
            {
                "message": message,
                "config_id": config_id,
                "success": success,
            }
        ),
    }


def _handle_get(payload: dict[str, Any]) -> dict[str, Any]:
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


def _handle_list(payload: dict[str, Any]) -> dict[str, Any]:
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


def delete_config(config_id: str) -> tuple[bool, str]:
    """
    Deletes configuration from S3.
    """
    try:
        key = f"configs/{config_id}.json"
        s3_client.delete_object(Bucket=CONFIG_BUCKET_NAME, Key=key)
        logger.info(f"Deleted config: {config_id}")
        return True, f"Config {config_id} deleted successfully"
    except Exception as e:
        logger.error(f"Failed to delete config {config_id}: {str(e)}")
        return False, str(e)


def _handle_delete(payload: dict[str, Any]) -> dict[str, Any]:
    config_id = payload.get("config_id")
    if not config_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "config_id required"}),
        }

    success, message = delete_config(config_id)
    return {
        "statusCode": 200 if success else 500,
        "body": json.dumps({"message": message, "success": success}),
    }


def lambda_handler(event, context):
    """
    Handles configuration CRUD.
    Actions: SAVE, GET, LIST, DELETE
    """
    try:
        logger.info("config_saver triggered")

        # Parse payload
        payload = _parse_payload(event)

        action = payload.get("action", "SAVE").upper()

        # SAVE: Save new configuration
        if action == "SAVE":
            return _handle_save(payload)

        # GET: Get configuration by ID
        elif action == "GET":
            return _handle_get(payload)

        # LIST: List by type
        elif action == "LIST":
            return _handle_list(payload)

        # DELETE: Delete configuration
        elif action == "DELETE":
            return _handle_delete(payload)

        else:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": f"Unknown action: {action}"}),
            }

    except Exception as e:
        logger.error(f"Error in config_saver: {str(e)}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
