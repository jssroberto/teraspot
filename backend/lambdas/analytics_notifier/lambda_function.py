import json
import boto3
import logging
import os
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

sqs = boto3.client('sqs', region_name='us-east-1')

SQS_ALERTS_URL = os.getenv('SQS_ALERTS_URL')
SQS_LOW_CONFIDENCE_URL = os.getenv('SQS_LOW_CONFIDENCE_URL')
DLQ_URL = os.getenv('DLQ_URL')
HISTORY_TABLE_NAME = os.getenv('HISTORY_TABLE', 'parking-history')

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
history_table = dynamodb.Table(HISTORY_TABLE_NAME)


def send_to_sqs(queue_url, message):
    """Envía mensaje a SQS con manejo de errores"""
    try:
        response = sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=json.dumps(message),
            MessageAttributes={
                'AlertType': {'StringValue': message.get('type', 'UNKNOWN'), 'DataType': 'String'},
                'Severity': {'StringValue': message.get('severity', 'INFO'), 'DataType': 'String'}
            }
        )
        logger.info(f"📤 Message sent to SQS: {response['MessageId']}")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send to SQS: {str(e)}")
        save_to_dlq(message, str(e))
        return False


def save_to_dlq(message, error_reason):
    """Guarda mensaje fallido en DLQ"""
    try:
        dlq_message = {
            'original_message': message,
            'error_reason': error_reason,
            'timestamp': datetime.utcnow().isoformat()
        }
        sqs.send_message(
            QueueUrl=DLQ_URL,
            MessageBody=json.dumps(dlq_message)
        )
        logger.error(f"🚨 Message moved to DLQ: {error_reason}")
    except Exception as e:
        logger.critical(f"💥 DLQ FAILED: {str(e)}")


def save_history(record):
    """Guarda el cambio de estado en la tabla de histórico"""
    try:
        new_image = record['dynamodb'].get('NewImage', {})
        
        if not new_image:
            logger.warning("⚠️ No NewImage found in record, skipping history save")
            return

        item = {
            'space_id': new_image.get('space_id', {}).get('S'),
            'timestamp': new_image.get('timestamp', {}).get('S'),
            'status': new_image.get('status', {}).get('S'),
            'confidence': new_image.get('confidence', {}).get('N'),
            'device_id': new_image.get('device_id', {}).get('S'),
            'archived_at': datetime.utcnow().isoformat()
        }
        
        item = {k: v for k, v in item.items() if v is not None}
        
        if 'confidence' in item:
            from decimal import Decimal
            item['confidence'] = Decimal(item['confidence'])

        history_table.put_item(Item=item)
        logger.info(f"📜 Archived to history: {item.get('space_id')} at {item.get('timestamp')}")

    except Exception as e:
        logger.error(f"❌ Failed to save history: {str(e)}")


def lambda_handler(event, context):
    """Analytics notifier: procesa alertas desde DynamoDB Streams"""
    try:
        logger.info("📨 analytics_notifier triggered")
        
        for record in event.get('Records', []):
            if record['eventName'] in ['MODIFY', 'INSERT']:
        
                old_image = record['dynamodb'].get('OldImage', {})
                new_image = record['dynamodb'].get('NewImage', {})
                
                logger.info(f"--- IMAGEN ANTIGUA (OldImage) ---")
                logger.info(json.dumps(old_image))
                
                logger.info(f"--- IMAGEN NUEVA (NewImage) ---")
                logger.info(json.dumps(new_image))
                
                save_history(record)
                
                space_id = new_image.get('space_id', {}).get('S', 'UNKNOWN')
                confidence = float(new_image.get('confidence', {}).get('N', 1.0))
                status = new_image.get('status', {}).get('S', 'UNKNOWN')
                
                if confidence < 0.8:
                    alert = {
                        'type': 'LOW_CONFIDENCE',
                        'space_id': space_id,
                        'confidence': confidence,
                        'severity': 'WARNING',
                        'timestamp': datetime.utcnow().isoformat()
                    }
                    send_to_sqs(SQS_LOW_CONFIDENCE_URL, alert)
                    logger.info(f"🚨 LOW_CONFIDENCE alert: {space_id}")
                
                occupied_count = sum(1 for r in event.get('Records', []) 
                                    if r['dynamodb'].get('NewImage', {}).get('status', {}).get('S') == 'occupied')
                total_records = len(event.get('Records', []))
                
                if total_records > 0 and occupied_count / total_records >= 0.8:
                    alert = {
                        'type': 'HIGH_OCCUPANCY',
                        'occupancy_percent': (occupied_count / total_records) * 100,
                        'occupied_count': occupied_count,
                        'total_count': total_records,
                        'severity': 'CRITICAL',
                        'timestamp': datetime.utcnow().isoformat()
                    }
                    send_to_sqs(SQS_ALERTS_URL, alert)
                    logger.info(f"🔴 HIGH_OCCUPANCY alert: {occupied_count}/{total_records}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({'success': True, 'message': 'Alerts processed'})
        }
    
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}", exc_info=True)
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}


