import json
import logging
import os
import time
import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)


AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
SCREENSHOT_BUCKET = os.getenv("SCREENSHOT_BUCKET", "teraspot-bucket")
IOT_ENDPOINT = os.getenv("IOT_ENDPOINT")

if IOT_ENDPOINT and not IOT_ENDPOINT.startswith("https://"):
    IOT_ENDPOINT = f"https://{IOT_ENDPOINT}"

s3_client = None
iot_client = None


def _generate_presigned_urls(device_id):
    """Generates presigned URLs for uploading and downloading a screenshot."""
    timestamp = int(time.time())
    key = f"screenshots/{device_id}/{timestamp}.jpg"
    
    try:
        upload_url = s3_client.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": SCREENSHOT_BUCKET,
                "Key": key,
                "ContentType": "image/jpeg"
            },
            ExpiresIn=300
        )
        
        download_url = s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": SCREENSHOT_BUCKET,
                "Key": key,
            },
            ExpiresIn=300
        )
        
        return upload_url, download_url, key
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


def _add_cors_headers(response):
    """Adds CORS headers to the response."""
    headers = response.get("headers", {})
    headers.update({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
        "Access-Control-Allow-Methods": "GET,OPTIONS,POST,PUT"
    })
    response["headers"] = headers
    return response


def lambda_handler(event, context):
    """
    Handles device commands.
    """
    try:
        logger.info("device_command triggered")
        
        # Handle OPTIONS preflight request
        if event.get("httpMethod") == "OPTIONS":
             return _add_cors_headers({
                "statusCode": 200,
                "body": json.dumps("OK")
            })
        
        global s3_client, iot_client
        if not s3_client:
            s3_client = boto3.client("s3", region_name=AWS_REGION)
        if not iot_client:
            iot_client = boto3.client("iot-data", region_name=AWS_REGION, endpoint_url=IOT_ENDPOINT)

        body = event.get("body", "{}")
        if isinstance(body, str):
            body = json.loads(body)
            
        device_id = body.get("device_id")
        command = body.get("command")
        
        if not device_id or not command:
            return _add_cors_headers({
                "statusCode": 400,
                "body": json.dumps({"error": "device_id and command are required"})
            })

        response_data = {"device_id": device_id, "command": command}

        if command == "screenshot":
            upload_url, download_url, key = _generate_presigned_urls(device_id)
            
            cmd_payload = {
                "command": "screenshot",
                "upload_url": upload_url,
                "timestamp": int(time.time())
            }
            _publish_command(device_id, cmd_payload)
            
            response_data["message"] = "Screenshot requested"
            response_data["upload_url"] = upload_url
            response_data["download_url"] = download_url
            response_data["s3_key"] = key

        elif command == "reload_config":
            cmd_payload = {
                "command": "reload_config",
                "timestamp": int(time.time())
            }
            _publish_command(device_id, cmd_payload)
            response_data["message"] = "Reload config requested"

        else:
            return _add_cors_headers({
                "statusCode": 400,
                "body": json.dumps({"error": f"Unknown command: {command}"})
            })

        return _add_cors_headers({
            "statusCode": 200,
            "body": json.dumps(response_data)
        })

    except Exception as e:
        logger.error(f"Error processing command: {str(e)}", exc_info=True)
        return _add_cors_headers({
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        })
