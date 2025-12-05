import json
import logging
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sqs = boto3.client("sqs", region_name="us-east-1")
sns = boto3.client("sns", region_name="us-east-1")
dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
s3 = boto3.client("s3", region_name="us-east-1")

SQS_ALERTS_URL = os.getenv("SQS_ALERTS_URL")
SQS_LOW_CONFIDENCE_URL = os.getenv("SQS_LOW_CONFIDENCE_URL")
DLQ_URL = os.getenv("DLQ_URL")
SNS_TOPIC_ARN = os.getenv("SNS_TOPIC_ARN")
HISTORY_TABLE_NAME = os.getenv("HISTORY_TABLE", "parking-history")
CURRENT_TABLE_NAME = os.getenv("DYNAMODB_TABLE", "parking-spaces-dev")

history_table = dynamodb.Table(HISTORY_TABLE_NAME)
current_table = dynamodb.Table(CURRENT_TABLE_NAME)

CONNECTIONS_TABLE = os.getenv("CONNECTIONS_TABLE")
WEBSOCKET_CALLBACK_URL = os.getenv("WEBSOCKET_CALLBACK_URL")
CONFIG_BUCKET_NAME = os.getenv("CONFIG_BUCKET_NAME", "teraspot-config-dev")

# Global Cache
cached_config = None
last_config_load = 0
CONFIG_TTL = 60  # Seconds

if WEBSOCKET_CALLBACK_URL:
    apigw_management = boto3.client(
        "apigatewaymanagementapi", endpoint_url=WEBSOCKET_CALLBACK_URL
    )
else:
    apigw_management = None


def send_to_sqs(queue_url, message):
    """Envía mensaje a SQS con manejo de errores"""
    if not queue_url:
        logger.warning(f"No Queue URL provided for message: {message}")
        return False

    try:
        response = sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(message),
            MessageAttributes={
                "AlertType": {
                    "StringValue": message.get("type", "UNKNOWN"),
                    "DataType": "String",
                },
                "Severity": {
                    "StringValue": message.get("severity", "INFO"),
                    "DataType": "String",
                },
            },
        )
        logger.info(f"Message sent to SQS: {response['MessageId']}")
        return True
    except Exception as e:
        logger.error(f"Failed to send to SQS: {str(e)}")
        save_to_dlq(message, str(e))
        return False

        return False


def save_alert_to_history(alert):
    """Saves alert to history table with space_id='ALERTS' for easy querying"""
    try:
        # Use a special PK 'ALERTS' to aggregate all alerts
        item = {
            "space_id": "ALERTS",
            "timestamp": alert["timestamp"],
            "status": f"ALERT:{alert['type']}",
            "device_id": alert.get("device_id", alert.get("space_id", "system")),
            "confidence": Decimal(str(alert.get("confidence", 1.0))),
            "details": json.dumps(alert),
            "archived_at": datetime.now(timezone.utc).isoformat(),
        }
        history_table.put_item(Item=item)
        logger.info(f"Alert persisted: {alert['type']}")
    except Exception as e:
        logger.error(f"Failed to persist alert: {e}")


def get_alert_config():
    """Fetches alert config from S3 with caching"""
    global cached_config, last_config_load

    now = datetime.now().timestamp()
    if cached_config and (now - last_config_load < CONFIG_TTL):
        return cached_config

    # Default Config
    config = {
        "occupancy_threshold_warning": 80,
        "occupancy_threshold_critical": 95,
        "confidence_threshold": 0.8,
        "inactive_timeout_minutes": 5,
        "channels": {"email": True, "app": True},
    }

    if not CONFIG_BUCKET_NAME:
        logger.warning("CONFIG_BUCKET_NAME not set, using defaults")
        return config

    try:
        key = "configs/alert-global.json"
        response = s3.get_object(Bucket=CONFIG_BUCKET_NAME, Key=key)
        content = response["Body"].read().decode("utf-8")
        data = json.loads(content)

        # Merge values
        if "value" in data:
            val = data["value"]
            config.update({k: v for k, v in val.items() if v is not None})

        cached_config = config
        last_config_load = now
        logger.info("Loaded alert config from S3")
    except s3.exceptions.NoSuchKey:
        logger.info("No alert config found in S3, using defaults")
    except Exception as e:
        logger.error(f"Error loading config from S3: {e}")

    return config


def publish_sns(subject, message_dict):
    """Publica mensaje a SNS para Email/SMS"""
    config = get_alert_config()
    if not config["channels"].get("email", True):
        # Email disabled
        return

    if not SNS_TOPIC_ARN:
        return

    try:
        # Format message cleanly for email
        email_body = f"""
ALERTA TERASPOT
===============
Type: {message_dict.get("type")}
Severity: {message_dict.get("severity")}
Time: {message_dict.get("timestamp")}

Details:
{json.dumps(message_dict, indent=2)}
"""
        sns.publish(TopicArn=SNS_TOPIC_ARN, Subject=subject, Message=email_body)
        logger.info(f"Published to SNS: {subject}")
    except Exception as e:
        logger.error(f"Failed to publish to SNS: {e}")


def save_to_dlq(message, error_reason):
    """Guarda mensaje fallido en DLQ"""
    if not DLQ_URL:
        logger.error("No DLQ URL configured")
        return

    try:
        dlq_message = {
            "original_message": message,
            "error_reason": error_reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        sqs.send_message(QueueUrl=DLQ_URL, MessageBody=json.dumps(dlq_message))
        logger.error(f" Message moved to DLQ: {error_reason}")
    except Exception as e:
        logger.critical(f" DLQ FAILED: {str(e)}")


def save_history(record):
    """Guarda el cambio de estado en la tabla de histórico"""
    try:
        new_image = record["dynamodb"].get("NewImage", {})

        if not new_image:
            logger.warning(" No NewImage found in record, skipping history save")
            return

        item = {
            "space_id": new_image.get("space_id", {}).get("S"),
            "timestamp": new_image.get("timestamp", {}).get("S"),
            "status": new_image.get("status", {}).get("S"),
            "confidence": new_image.get("confidence", {}).get("N"),
            "device_id": new_image.get("device_id", {}).get("S"),
            "archived_at": datetime.now(timezone.utc).isoformat(),
        }

        item = {k: v for k, v in item.items() if v is not None}

        if "confidence" in item:
            item["confidence"] = Decimal(item["confidence"])

        history_table.put_item(Item=item)
        logger.info(
            f" Archived to history: {item.get('space_id')} at {item.get('timestamp')}"
        )

    except Exception as e:
        logger.error(f" Failed to save history: {str(e)}")


def get_current_occupancy():
    """Calcula la ocupación actual escaneando la tabla de estado"""
    try:
        response = current_table.scan(
            ProjectionExpression="#st", ExpressionAttributeNames={"#st": "status"}
        )
        items = response.get("Items", [])
        total = len(items)
        occupied = sum(1 for item in items if item.get("status") == "occupied")

        return occupied, total
    except Exception as e:
        logger.error(f"Failed to get occupancy: {str(e)}")
        return 0, 0


def check_inactive_sensors():
    """Revisa sensores que no han reportado en > 5 minutos"""
    logger.info(" Running Health Check...")
    try:
        response = current_table.scan(
            ProjectionExpression="space_id, #ts, device_id, last_heartbeat, is_alive",
            ExpressionAttributeNames={"#ts": "timestamp"},
        )

        now = datetime.now(timezone.utc)
        config = get_alert_config()
        inactive_min = config.get("inactive_timeout_minutes", 5)
        threshold = timedelta(minutes=inactive_min)
        inactive_devices = set()

        for item in response.get("Items", []):
            space_id = item.get("space_id")
            # Use last_heartbeat if available, else fallback to timestamp
            last_activity_str = item.get("last_heartbeat") or item.get("timestamp")
            is_alive = item.get("is_alive", True)

            if not last_activity_str:
                continue

            try:
                last_activity_str = last_activity_str.replace("Z", "+00:00")
                last_seen = datetime.fromisoformat(last_activity_str)

                if now - last_seen > threshold:
                    if is_alive:
                        # Mark as dead
                        device_id = item.get("device_id", "unknown")
                        inactive_devices.add(device_id)
                        logger.warning(
                            f"Stale sensor detected: {space_id} (Last seen: {last_activity_str})"
                        )

                        # 1. Update Current: is_alive = False
                        current_table.update_item(
                            Key={"space_id": space_id},
                            UpdateExpression="set is_alive = :val",
                            ExpressionAttributeValues={":val": False},
                        )

                        # 2. Write History: Status = 'dead' (or just record the event)
                        # User said: "updating only when the device is dead"
                        history_item = {
                            "space_id": space_id,
                            "timestamp": now.isoformat(),
                            "status": "dead",  # Special status for death
                            "confidence": Decimal("1.0"),
                            "device_id": device_id,
                            "archived_at": now.isoformat(),
                        }
                        history_table.put_item(Item=history_item)
                        logger.info(f"Recorded death in history for {space_id}")

            except ValueError:
                continue

        for device in inactive_devices:
            alert = {
                "type": "INACTIVE_SENSOR",
                "device_id": device,
                "severity": "WARNING",
                "message": f"Device {device} has not reported in > {inactive_min} minutes",
                "timestamp": now.isoformat(),
            }
            send_to_sqs(SQS_ALERTS_URL, alert)
            publish_sns(f"⚠️ Device Offline: {device}", alert)
            notify_clients(alert)  # Broadcast to WebSocket
            save_alert_to_history(alert)
            logger.info(f" Sent INACTIVE_SENSOR alert for {device}")

        return len(inactive_devices)

    except Exception as e:
        logger.error(f" Health Check Failed: {str(e)}")
        return 0


def notify_clients(message):
    """Push message to all connected WebSocket clients"""
    if not apigw_management or not CONNECTIONS_TABLE:
        logger.warning("WebSocket not configured, skipping notification")
        return

    try:
        connections_table = dynamodb.Table(CONNECTIONS_TABLE)
        response = connections_table.scan(ProjectionExpression="connection_id")
        items = response.get("Items", [])

        if not items:
            return

        logger.info(f"Pushing update to {len(items)} clients...")

        # Convert Decimals to float/int for JSON serialization
        def decimal_default(obj):
            if isinstance(obj, Decimal):
                return float(obj)
            raise TypeError

        payload = json.dumps(message, default=decimal_default).encode("utf-8")

        for item in items:
            connection_id = item["connection_id"]
            try:
                apigw_management.post_to_connection(
                    ConnectionId=connection_id, Data=payload
                )
            except apigw_management.exceptions.GoneException:
                logger.info(f"Connection {connection_id} is gone, deleting...")
                connections_table.delete_item(Key={"connection_id": connection_id})
            except Exception as e:
                logger.error(f"Failed to post to {connection_id}: {e}")

    except Exception as e:
        logger.error(f"Failed to notify clients: {e}")


def process_stream_records(records):
    """Procesa registros de DynamoDB Stream"""
    for record in records:
        if record["eventName"] in ["MODIFY", "INSERT"]:
            # REMOVED: save_history(record) - History is now handled by ingest_status and check_inactive_sensors

            new_image = record["dynamodb"].get("NewImage", {})
            space_id = new_image.get("space_id", {}).get("S", "UNKNOWN")
            confidence = float(new_image.get("confidence", {}).get("N", 1.0))

            config = get_alert_config()
            conf_threshold = config.get("confidence_threshold", 0.8)

            if confidence < conf_threshold:
                alert = {
                    "type": "LOW_CONFIDENCE",
                    "space_id": space_id,
                    "confidence": confidence,
                    "severity": "WARNING",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                send_to_sqs(SQS_LOW_CONFIDENCE_URL, alert)
                # We won't publish to SNS for low confidence alerts for now
                # publish_sns(f"⚠️ Low Confidence: {space_id}", alert)
                save_alert_to_history(alert)
                logger.info(f" LOW_CONFIDENCE alert: {space_id}")

            # Notify WebSocket Clients
            update_msg = {
                "type": "UPDATE",
                "data": {
                    "space_id": space_id,
                    "status": new_image.get("status", {}).get("S"),
                    "confidence": confidence,
                    "timestamp": new_image.get("timestamp", {}).get("S"),
                    "is_alive": new_image.get("is_alive", {}).get("BOOL", True),
                },
            }
            notify_clients(update_msg)

    occupied, total = get_current_occupancy()
    if total > 0:
        occupancy_pct = (occupied / total) * 100
        logger.info(f"Current Occupancy: {occupied}/{total} ({occupancy_pct:.1f}%)")

        config = get_alert_config()
        crit_thresh = config.get("occupancy_threshold_critical", 95)
        warn_thresh = config.get("occupancy_threshold_warning", 80)

        if occupancy_pct >= crit_thresh:
            alert = {
                "type": "HIGH_OCCUPANCY",
                "occupancy_percent": occupancy_pct,
                "occupied_count": occupied,
                "total_count": total,
                "severity": "CRITICAL",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            send_to_sqs(SQS_ALERTS_URL, alert)
            publish_sns(f"🚨 CRITICAL OCCUPANCY: {occupancy_pct:.1f}%", alert)
            notify_clients(alert)  # Broadcast to WebSocket
            save_alert_to_history(alert)
            logger.info("HIGH_OCCUPANCY (CRITICAL) alert sent")
        elif occupancy_pct >= warn_thresh:
            alert = {
                "type": "HIGH_OCCUPANCY",
                "occupancy_percent": occupancy_pct,
                "occupied_count": occupied,
                "total_count": total,
                "severity": "WARNING",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            send_to_sqs(SQS_ALERTS_URL, alert)
            publish_sns(f"⚠️ High Occupancy: {occupancy_pct:.1f}%", alert)
            notify_clients(alert)  # Broadcast to WebSocket
            save_alert_to_history(alert)
            logger.info("HIGH_OCCUPANCY (WARNING) alert sent")


def lambda_handler(event, context):
    """Handler principal: Soporta Streams y EventBridge"""
    try:
        if event.get("source") == "aws.events":
            logger.info("Scheduled Event triggered")
            inactive_count = check_inactive_sensors()
            return {
                "statusCode": 200,
                "body": json.dumps(
                    {
                        "message": "Health check complete",
                        "inactive_devices": inactive_count,
                    }
                ),
            }

        if "Records" in event:
            logger.info(f" Stream Event: {len(event['Records'])} records")
            process_stream_records(event["Records"])
            return {
                "statusCode": 200,
                "body": json.dumps(
                    {"success": True, "message": "Stream records processed"}
                ),
            }

        logger.warning("Unknown event source")
        return {"statusCode": 400, "body": "Unknown event source"}

    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
