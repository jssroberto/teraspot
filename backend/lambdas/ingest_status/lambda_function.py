import json
import logging
import os
import boto3
from datetime import datetime
from decimal import Decimal

logger = logging.getLogger()
logger.setLevel(logging.INFO)

DYNAMODB_TABLE = os.getenv('DYNAMODB_TABLE', 'parking-spaces')
HISTORY_TABLE = os.getenv('HISTORY_TABLE', 'parking-history')
REGION = os.getenv('REGION', 'us-east-1')

dynamodb = boto3.resource('dynamodb', region_name=REGION)
current_table = dynamodb.Table(DYNAMODB_TABLE)
history_table = dynamodb.Table(HISTORY_TABLE)


def validate_data(space_id: str, data: dict) -> tuple:
    """QA validation - 5 capas"""
    
    # CAPA 1: Tipo
    if not isinstance(data.get('confidence'), (int, float)):
        return False, "Invalid confidence type"
    
    confidence = float(data['confidence'])
    
    # CAPA 2: Rango
    if not (0 <= confidence <= 1):
        return False, f"Confidence out of range: {confidence}"
    
    # CAPA 3: Status válido
    status = data.get('status', '').lower()
    if status not in ['occupied', 'vacant']:
        return False, f"Invalid status: {status}"
    
    # CAPA 4: Timestamp
    timestamp = data.get('timestamp', datetime.utcnow().isoformat())
    try:
        datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except:
        return False, "Invalid timestamp"
    
    # CAPA 5: Business rules
    if confidence < 0.8:
        logger.warning(f"⚠️ LOW_CONFIDENCE: {space_id} = {confidence:.2f}")
    
    return True, ""


def save_current(items: list):
    """Guarda DATOS ACTUALES"""
    for item in items:
        try:
            current_table.put_item(Item=item)
            logger.info(f"✅ Current: {item['space_id']} = {item['status']}")
        except Exception as e:
            logger.error(f"❌ Current save error: {str(e)}")


def save_history(items: list):
    """Guarda HISTÓRICO (series temporales)"""
    for item in items:
        try:
            history_item = {
                'space_id': item['space_id'],
                'timestamp': item.get('timestamp', datetime.utcnow().isoformat()),
                'status': item['status'],
                'confidence': Decimal(str(item['confidence'])),
                'device_id': item.get('device_id', 'unknown')
            }
            history_table.put_item(Item=history_item)
            logger.info(f"✅ History: {item['space_id']} at {history_item['timestamp']}")
        except Exception as e:
            logger.error(f"❌ History save error: {str(e)}")


def generate_alerts(items: list) -> list:
    """Genera alertas basadas en QA"""
    alerts = []
    occupied = sum(1 for i in items if i['status'] == 'occupied')
    total = len(items)
    occupancy = occupied / total if total > 0 else 0
    
    # ALERTA 1: Baja confianza
    for item in items:
        conf = float(item['confidence'])
        if conf < 0.8:
            alerts.append({
                'type': 'LOW_CONFIDENCE',
                'severity': 'WARNING',
                'space_id': item['space_id'],
                'message': f'⚠️ {item["space_id"]}: {conf:.2f}',
            })
    
    # ALERTA 2: Ocupación alta
    if occupancy >= 0.95:
        alerts.append({
            'type': 'CRITICAL',
            'severity': 'CRITICAL',
            'message': f'🔴 {occupancy*100:.0f}% FULL',
        })
    elif occupancy >= 0.80:
        alerts.append({
            'type': 'HIGH',
            'severity': 'WARNING',
            'message': f'🟠 {occupancy*100:.0f}% full',
        })
    
    return alerts


def lambda_handler(event, context):
    """
    PIPELINE COMPLETO:
    MQTT → QA Validation → DynamoDB (actual + histórico) → Alertas
    """
    try:
        logger.info("📨 ingest_status triggered")
        
        # Parse payload
        payload = event.get('body')
        if isinstance(payload, str):
            payload = json.loads(payload)
        else:
            payload = event
        
        device_id = payload.get('device_id', 'unknown')
        items = []
        rejected = 0
        
        # PASO 1: QA Validation
        logger.info("🔍 QA Validation")
        for space_id, space_data in payload.get('spaces', {}).items():
            is_valid, error = validate_data(space_id, space_data)
            
            if not is_valid:
                logger.warning(f"🚫 REJECTED {space_id}: {error}")
                rejected += 1
                continue
            
            item = {
                'space_id': space_id,
                'status': space_data['status'],
                'confidence': Decimal(str(space_data['confidence'])),
                'timestamp': payload.get('timestamp', datetime.utcnow().isoformat()),
                'device_id': device_id
            }
            items.append(item)
        
        if not items:
            logger.error(f"❌ No valid items (rejected: {rejected})")
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'No items',
                    'rejected': rejected  # ← AGREGAR
                })
            }

        
        # PASO 2: Guardar ACTUAL
        logger.info("💾 Saving current data")
        save_current(items)
        
        # PASO 3: Guardar HISTÓRICO
        logger.info("📊 Saving historical data")
        save_history(items)
        
        # PASO 4: Generar alertas
        logger.info("🚨 Generating alerts")
        alerts = generate_alerts(items)
        
        logger.info(f"✅ Complete: {len(items)} items, {len(alerts)} alerts, {rejected} rejected")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'items': len(items),
                'alerts': len(alerts),
                'rejected': rejected
            })
        }
    
    except Exception as e:
        logger.error(f"❌ ERROR: {str(e)}", exc_info=True)
        return {'statusCode': 500, 'body': json.dumps({'error': str(e)})}
