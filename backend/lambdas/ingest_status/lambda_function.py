import json
import logging
import os
import boto3
from datetime import datetime
from decimal import Decimal
from typing import Dict, Any, List, Tuple

logger = logging.getLogger()
logger.setLevel(logging.INFO)

TABLE_NAME = os.getenv("DYNAMODB_TABLE_NAME", "parking-spaces-dev")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)

# Constantes de alertas
CONFIDENCE_THRESHOLD = 0.8  # ⚠️ Alerta si < 0.8
OCCUPANCY_HIGH = 0.80  # 🟠 80% ocupados
OCCUPANCY_CRITICAL = 0.95  # 🔴 95% ocupados


def validate_quality(space_id: str, space_data: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Valida que los datos cumplan con estándares de calidad.
    Retorna: (es_válido, mensaje_error)
    """
    status = space_data.get('status')
    confidence = space_data.get('confidence')
    
    # Validar status
    if status not in ['occupied', 'vacant']:
        return False, f"Invalid status '{status}' for {space_id}. Must be 'occupied' or 'vacant'"
    
    # Validar confidence
    if confidence is None:
        return False, f"Missing confidence for {space_id}"
    
    try:
        conf_float = float(confidence)
        if not (0 <= conf_float <= 1):
            return False, f"Confidence {conf_float} out of range [0, 1] for {space_id}"
    except (ValueError, TypeError):
        return False, f"Invalid confidence type for {space_id}"
    
    return True, ""


def check_alerts(space_id: str, status: str, confidence: float, 
                 total_spaces: int, occupied_count: int) -> List[Dict[str, Any]]:
    """
    Genera alertas basadas en reglas de negocio.
    Retorna lista de alertas detectadas.
    """
    alerts = []
    
    # Alerta 1: Baja confianza
    if confidence < CONFIDENCE_THRESHOLD:
        alerts.append({
            'type': 'LOW_CONFIDENCE',
            'space_id': space_id,
            'severity': 'WARNING',
            'confidence': confidence,
            'message': f"⚠️ {space_id}: Low confidence ({confidence:.2f})"
        })
    
    # Alerta 2: Alta ocupación (80%)
    occupancy_rate = occupied_count / total_spaces if total_spaces > 0 else 0
    if occupancy_rate >= OCCUPANCY_HIGH and occupancy_rate < OCCUPANCY_CRITICAL:
        alerts.append({
            'type': 'HIGH_OCCUPANCY',
            'severity': 'ALERT',
            'occupancy_rate': occupancy_rate,
            'message': f"🟠 HIGH occupancy: {occupancy_rate*100:.1f}%"
        })
    
    # Alerta 3: Ocupación crítica (95%)
    if occupancy_rate >= OCCUPANCY_CRITICAL:
        alerts.append({
            'type': 'CRITICAL_OCCUPANCY',
            'severity': 'CRITICAL',
            'occupancy_rate': occupancy_rate,
            'message': f"🔴 CRITICAL occupancy: {occupancy_rate*100:.1f}%"
        })
    
    return alerts


def build_items(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Construye items DynamoDB con validación y conversión de tipos.
    """
    items = []
    timestamp = payload.get('timestamp', datetime.utcnow().isoformat() + 'Z')
    device_id = payload.get('device_id', 'unknown')
    
    for space_id, space_data in payload.get('spaces', {}).items():
        # Validar calidad
        is_valid, error_msg = validate_quality(space_id, space_data)
        if not is_valid:
            logger.warning(f"QA Error: {error_msg}")
            continue
        
        # Construir item
        item = {
            'space_id': space_id,
            'status': space_data.get('status'),
            'confidence': Decimal(str(space_data.get('confidence', 0))),
            'timestamp': timestamp,
            'device_id': device_id
        }
        items.append(item)
    
    return items


def save_to_dynamodb(items: List[Dict[str, Any]]) -> Tuple[int, int]:
    """
    Guarda items a DynamoDB con error handling.
    Retorna: (exitosos, fallidos)
    """
    success_count = 0
    failed_count = 0
    
    for item in items:
        try:
            table.put_item(Item=item)
            success_count += 1
        except Exception as e:
            logger.error(f"Failed to write {item['space_id']}: {str(e)}")
            failed_count += 1
    
    return success_count, failed_count


def lambda_handler(event, context):
    """
    Orquestador principal: Procesa MQTT → QA → Alerts → DynamoDB
    """
    try:
        logger.info("📨 Lambda ingest_status triggered")
        
        # Parsear payload
        if 'body' in event:
            payload = json.loads(event['body'])
        else:
            payload = event
        
        # Step 1: Construir items con validación
        items = build_items(payload)
        if not items:
            logger.warning("⚠️ No valid items to process")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'No valid items', 'items_processed': 0})
            }
        
        # Step 2: Guardar a DynamoDB
        success, failed = save_to_dynamodb(items)
        logger.info(f"✅ Wrote {success} items, {failed} failed")
        
        # Step 3: Generar alertas
        total_spaces = len(items)
        occupied_count = sum(1 for item in items if item['status'] == 'occupied')
        
        all_alerts = []
        for item in items:
            alerts = check_alerts(
                item['space_id'],
                item['status'],
                float(item['confidence']),
                total_spaces,
                occupied_count
            )
            all_alerts.extend(alerts)
        
        logger.info(f"🔔 Generated {len(all_alerts)} alerts")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Success',
                'items_processed': success,
                'qa_errors': failed,
                'alerts_count': len(all_alerts),
                'alerts': all_alerts
            }, default=str)
        }
    
    except Exception as e:
        logger.error(f"❌ Error in ingest_status: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
