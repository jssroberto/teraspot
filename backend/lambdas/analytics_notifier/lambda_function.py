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
            ProjectionExpression='space_id, #ts, device_id',
            ExpressionAttributeNames={'#ts': 'timestamp'}
        )
        
        now = datetime.now(timezone.utc)
        threshold = timedelta(minutes=5)
        inactive_devices = set()
        
        for item in response.get('Items', []):
            ts_str = item.get('timestamp')
            if not ts_str:
                continue
                
            try:
                
                ts_str = ts_str.replace('Z', '+00:00')
                last_seen = datetime.fromisoformat(ts_str)
                
                if now - last_seen > threshold:
                    device_id = item.get('device_id', 'unknown')
                    inactive_devices.add(device_id)
                    logger.warning(f"Stale sensor: {item.get('space_id')} (Last seen: {ts_str})")
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
            logger.info(f" Sent INACTIVE_SENSOR alert for {device}")
            
        return len(inactive_devices)

    except Exception as e:
        logger.error(f" Health Check Failed: {str(e)}")
        return 0


def process_stream_records(records):
    """Procesa registros de DynamoDB Stream"""
    for record in records:
        if record['eventName'] in ['MODIFY', 'INSERT']:
            
            
            save_history(record)
            
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
                logger.info(f" LOW_CONFIDENCE alert: {space_id}")

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
