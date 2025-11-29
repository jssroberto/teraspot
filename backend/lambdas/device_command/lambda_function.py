import json
import logging
import os
import time
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuration
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
SCREENSHOT_BUCKET = os.getenv("SCREENSHOT_BUCKET", "teraspot-bucket")
IOT_ENDPOINT = os.getenv("IOT_ENDPOINT")

if IOT_ENDPOINT and not IOT_ENDPOINT.startswith("https://"):
    IOT_ENDPOINT = f"https://{IOT_ENDPOINT}"

# Initialize clients
s3_client = boto3.client("s3", region_name=AWS_REGION)
iot_client = boto3.client("iot-data", region_name=AWS_REGION, endpoint_url=IOT_ENDPOINT)


def _generate_presigned_url(device_id):
    """Generates a presigned URL for uploading a screenshot."""
    timestamp = int(time.time())
    key = f"screenshots/{device_id}/{timestamp}.jpg"
    
    try:
        url = s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": SCREENSHOT_BUCKET,
                "Key": key,
                "ContentType": "image/jpeg"
            },
            ExpiresIn=300  # 5 minutes
        )
        return url, key
    except ClientError as e:
        logger.error(f"Error generating presigned URL: {e}")
        raise


def _publish_command(device_id, payload):
    """Publishes a command to the device's MQTT topic."""
    topic = f"teraspot/commands/{device_id}"
    try:
        iot_client.publish(
            topic=topic,
            qos=1,
            payload=json.dumps(payload)
        )
        logger.info(f"Published command to {topic}: {payload}")
    except ClientError as e:
        logger.error(f"Error publishing to IoT: {e}")
        raise


def lambda_handler(event, context):
    """
    Handles device commands.
    Payload: {"device_id": "...", "command": "screenshot" | "reload_config"}
    """
    try:
        logger.info("device_command triggered")
        
        # Parse body
        body = event.get("body", "{}")
        if isinstance(body, str):
            body = json.loads(body)
            
        device_id = body.get("device_id")
        command = body.get("command")
        
        if not device_id or not command:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "device_id and command are required"})
            }

        response_data = {"device_id": device_id, "command": command}

        if command == "screenshot":
            # 1. Generate Presigned URL
            upload_url, key = _generate_presigned_url(device_id)
            
            # 2. Send command to device
            cmd_payload = {
                "command": "screenshot",
                "upload_url": upload_url,
                "timestamp": int(time.time())
            }
            _publish_command(device_id, cmd_payload)
            
            response_data["message"] = "Screenshot requested"
            response_data["upload_url"] = upload_url
            response_data["s3_key"] = key

        elif command == "reload_config":
            # Send reload command
            cmd_payload = {
                "command": "reload_config",
                "timestamp": int(time.time())
            }
            _publish_command(device_id, cmd_payload)
            response_data["message"] = "Reload config requested"

        else:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": f"Unknown command: {command}"})
            }

        return {
            "statusCode": 200,
            "body": json.dumps(response_data)
        }

    except Exception as e:
        logger.error(f"Error processing command: {str(e)}", exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
