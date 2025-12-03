import json
import boto3
import logging
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sqs = boto3.client('sqs', region_name='us-east-1')
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')

SQS_ALERTS_URL = os.getenv('SQS_ALERTS_URL')
SQS_LOW_CONFIDENCE_URL = os.getenv('SQS_LOW_CONFIDENCE_URL')
DLQ_URL = os.getenv('DLQ_URL')
HISTORY_TABLE_NAME = os.getenv('HISTORY_TABLE', 'parking-history')
CURRENT_TABLE_NAME = os.getenv('DYNAMODB_TABLE', 'parking-spaces-dev')

history_table = dynamodb.Table(HISTORY_TABLE_NAME)
current_table = dynamodb.Table(CURRENT_TABLE_NAME)

CONNECTIONS_TABLE = os.getenv('CONNECTIONS_TABLE')
WEBSOCKET_CALLBACK_URL = os.getenv('WEBSOCKET_CALLBACK_URL')

if WEBSOCKET_CALLBACK_URL:
    apigw_management = boto3.client(
        'apigatewaymanagementapi', endpoint_url=WEBSOCKET_CALLBACK_URL
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
                'AlertType': {'StringValue': message.get('type', 'UNKNOWN'), 'DataType': 'String'},
                'Severity': {'StringValue': message.get('severity', 'INFO'), 'DataType': 'String'}
            }
        )
        logger.info(f"Message sent to SQS: {response['MessageId']}")
        return True
    except Exception as e:
        logger.error(f"Failed to send to SQS: {str(e)}")
        save_to_dlq(message, str(e))
        return False


def save_to_dlq(message, error_reason):
    """Guarda mensaje fallido en DLQ"""
    if not DLQ_URL:
        logger.error("No DLQ URL configured")
        return

    try:
        dlq_message = {
            'original_message': message,
            'error_reason': error_reason,
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        sqs.send_message(
            QueueUrl=DLQ_URL,
            MessageBody=json.dumps(dlq_message)
        )
        logger.error(f" Message moved to DLQ: {error_reason}")
    except Exception as e:
        logger.critical(f" DLQ FAILED: {str(e)}")


def save_history(record):
    """Guarda el cambio de estado en la tabla de histórico"""
    try:
        new_image = record['dynamodb'].get('NewImage', {})
        
        if not new_image:
            logger.warning(" No NewImage found in record, skipping history save")
            return

        item = {
            'space_id': new_image.get('space_id', {}).get('S'),
            'timestamp': new_image.get('timestamp', {}).get('S'),
            'status': new_image.get('status', {}).get('S'),
            'confidence': new_image.get('confidence', {}).get('N'),
            'device_id': new_image.get('device_id', {}).get('S'),
            'archived_at': datetime.now(timezone.utc).isoformat()
        }
        
        item = {k: v for k, v in item.items() if v is not None}
        
        if 'confidence' in item:
            item['confidence'] = Decimal(item['confidence'])

        history_table.put_item(Item=item)
        logger.info(f" Archived to history: {item.get('space_id')} at {item.get('timestamp')}")

    except Exception as e:
        logger.error(f" Failed to save history: {str(e)}")


def get_current_occupancy():
    """Calcula la ocupación actual escaneando la tabla de estado"""
    try:
        
        response = current_table.scan(
            ProjectionExpression='#st',
            ExpressionAttributeNames={'#st': 'status'}
        )
        items = response.get('Items', [])
        total = len(items)
        occupied = sum(1 for item in items if item.get('status') == 'occupied')
        
        return occupied, total
    except Exception as e:
        logger.error(f"Failed to get occupancy: {str(e)}")
        return 0, 0


def check_inactive_sensors():
    """Revisa sensores que no han reportado en > 5 minutos"""
    logger.info(" Running Health Check...")
    try:
        
        response = current_table.scan(
            ProjectionExpression='space_id, #ts, device_id, last_heartbeat, is_alive',
            ExpressionAttributeNames={'#ts': 'timestamp'}
        )
        
        now = datetime.now(timezone.utc)
        threshold = timedelta(minutes=5)
        inactive_devices = set()
        
        for item in response.get('Items', []):
            space_id = item.get('space_id')
            # Use last_heartbeat if available, else fallback to timestamp
            last_activity_str = item.get('last_heartbeat') or item.get('timestamp')
            is_alive = item.get('is_alive', True)
            
            if not last_activity_str:
                continue
                
            try:
                last_activity_str = last_activity_str.replace('Z', '+00:00')
                last_seen = datetime.fromisoformat(last_activity_str)
                
                if now - last_seen > threshold:
                    if is_alive:
                        # Mark as dead
                        device_id = item.get('device_id', 'unknown')
                        inactive_devices.add(device_id)
                        logger.warning(f"Stale sensor detected: {space_id} (Last seen: {last_activity_str})")
                        
                        # 1. Update Current: is_alive = False
                        current_table.update_item(
                            Key={'space_id': space_id},
                            UpdateExpression="set is_alive = :val",
                            ExpressionAttributeValues={':val': False}
                        )
                        
                        # 2. Write History: Status = 'dead' (or just record the event)
                        # User said: "updating only when the device is dead"
                        history_item = {
                            'space_id': space_id,
                            'timestamp': now.isoformat(),
                            'status': 'dead', # Special status for death
                            'confidence': Decimal('1.0'),
                            'device_id': device_id,
                            'archived_at': now.isoformat()
                        }
                        history_table.put_item(Item=history_item)
                        logger.info(f"Recorded death in history for {space_id}")

            except ValueError:
                continue

        
        for device in inactive_devices:
            alert = {
                'type': 'INACTIVE_SENSOR',
                'device_id': device,
                'severity': 'WARNING',
                'message': f"Device {device} has not reported in > 5 minutes",
                'timestamp': now.isoformat()
            }
            send_to_sqs(SQS_ALERTS_URL, alert)
            notify_clients(alert) # Broadcast to WebSocket
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
        if record['eventName'] in ['MODIFY', 'INSERT']:
            
            # REMOVED: save_history(record) - History is now handled by ingest_status and check_inactive_sensors
            
            new_image = record['dynamodb'].get('NewImage', {})
            space_id = new_image.get('space_id', {}).get('S', 'UNKNOWN')
            confidence = float(new_image.get('confidence', {}).get('N', 1.0))
            
            
            if confidence < 0.8:
                alert = {
                    'type': 'LOW_CONFIDENCE',
                    'space_id': space_id,
                    'confidence': confidence,
                    'severity': 'WARNING',
                    'timestamp': datetime.now(timezone.utc).isoformat()
                }
                send_to_sqs(SQS_LOW_CONFIDENCE_URL, alert)
                send_to_sqs(SQS_LOW_CONFIDENCE_URL, alert)
                logger.info(f" LOW_CONFIDENCE alert: {space_id}")

            # Notify WebSocket Clients
            update_msg = {
                "type": "UPDATE",
                "data": {
                    "space_id": space_id,
                    "status": new_image.get('status', {}).get('S'),
                    "confidence": confidence,
                    "timestamp": new_image.get('timestamp', {}).get('S')
                }
            }
            notify_clients(update_msg)


    occupied, total = get_current_occupancy()
    if total > 0:
        occupancy_pct = (occupied / total) * 100
        logger.info(f"Current Occupancy: {occupied}/{total} ({occupancy_pct:.1f}%)")
        
        if occupancy_pct >= 95:
            alert = {
                'type': 'HIGH_OCCUPANCY',
                'occupancy_percent': occupancy_pct,
                'occupied_count': occupied,
                'total_count': total,
                'severity': 'CRITICAL',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            send_to_sqs(SQS_ALERTS_URL, alert)
            notify_clients(alert) # Broadcast to WebSocket
            logger.info(f"HIGH_OCCUPANCY (CRITICAL) alert sent")
        elif occupancy_pct >= 80:
            alert = {
                'type': 'HIGH_OCCUPANCY',
                'occupancy_percent': occupancy_pct,
                'occupied_count': occupied,
                'total_count': total,
                'severity': 'WARNING',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            send_to_sqs(SQS_ALERTS_URL, alert)
            notify_clients(alert) # Broadcast to WebSocket
            logger.info(f"HIGH_OCCUPANCY (WARNING) alert sent")


def lambda_handler(event, context):
    """Handler principal: Soporta Streams y EventBridge"""
    try:
        if event.get('source') == 'aws.events':
            logger.info("Scheduled Event triggered")
            inactive_count = check_inactive_sensors()
            return {
                'statusCode': 200, 
                'body': json.dumps({'message': 'Health check complete', 'inactive_devices': inactive_count})
            }

        if 'Records' in event:
            logger.info(f" Stream Event: {len(event['Records'])} records")
            process_stream_records(event['Records'])
            return {
                'statusCode': 200,
                'body': json.dumps({'success': True, 'message': 'Stream records processed'})
            }

        logger.warning("Unknown event source")
        return {'statusCode': 400, 'body': 'Unknown event source'}
    
    except Exception as e:
        logger.error(f"Error: {str(e)}", exc_info=True)
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
