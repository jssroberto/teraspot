import json
import logging
import os
import boto3
from decimal import Decimal
from typing import Dict, Any, List

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuración
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
TABLE_NAME = os.getenv('DYNAMODB_TABLE_NAME', 'parking-spaces-dev')

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
table = dynamodb.Table(TABLE_NAME)


def decimal_to_float(obj):
    """Convierte Decimal a float para JSON"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


def get_all_spaces() -> Dict[str, Any]:
    """
    Obtiene todos los espacios de estacionamiento.
    """
    try:
        response = table.scan()
        items = response.get('Items', [])
        
        logger.info(f"✅ Retrieved {len(items)} parking spaces")
        
        occupied = sum(1 for item in items if item.get('status') == 'occupied')
        vacant = len(items) - occupied
        
        return {
            'spaces': items,
            'summary': {
                'total': len(items),
                'occupied': occupied,
                'vacant': vacant,
                'occupancy_rate': occupied / len(items) if len(items) > 0 else 0
            }
        }
    except Exception as e:
        logger.error(f"❌ Error scanning spaces: {str(e)}")
        return {'error': str(e), 'spaces': []}


def get_space_by_id(space_id: str) -> Dict[str, Any]:
    """
    Obtiene información de un espacio específico.
    """
    try:
        response = table.get_item(Key={'space_id': space_id})
        item = response.get('Item', {})
        
        if not item:
            logger.warning(f"⚠️ Space {space_id} not found")
            return {'error': f'Space {space_id} not found'}
        
        logger.info(f"✅ Retrieved space {space_id}")
        return {'space': item}
    
    except Exception as e:
        logger.error(f"❌ Error getting space {space_id}: {str(e)}")
        return {'error': str(e)}


def get_occupied_spaces() -> Dict[str, Any]:
    """
    Obtiene solo los espacios ocupados.
    """
    try:
        response = table.scan(
            FilterExpression='#status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'occupied'}
        )
        items = response.get('Items', [])
        
        logger.info(f"✅ Retrieved {len(items)} occupied spaces")
        
        return {
            'occupied_spaces': items,
            'count': len(items)
        }
    except Exception as e:
        logger.error(f"❌ Error getting occupied spaces: {str(e)}")
        return {'error': str(e)}


def get_vacant_spaces() -> Dict[str, Any]:
    """
    Obtiene solo los espacios libres.
    """
    try:
        response = table.scan(
            FilterExpression='#status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'vacant'}
        )
        items = response.get('Items', [])
        
        logger.info(f"✅ Retrieved {len(items)} vacant spaces")
        
        return {
            'vacant_spaces': items,
            'count': len(items)
        }
    except Exception as e:
        logger.error(f"❌ Error getting vacant spaces: {str(e)}")
        return {'error': str(e)}


def get_occupancy_statistics() -> Dict[str, Any]:
    """
    Calcula estadísticas de ocupación.
    """
    try:
        response = table.scan()
        items = response.get('Items', [])
        
        if not items:
            return {
                'occupancy_rate': 0,
                'occupied_count': 0,
                'vacant_count': 0,
                'total_spaces': 0
            }
        
        occupied = sum(1 for item in items if item.get('status') == 'occupied')
        vacant = len(items) - occupied
        occupancy_rate = occupied / len(items)
        
        # Calcular confianza promedio
        confidences = [float(item.get('confidence', 0)) for item in items]
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0
        
        logger.info(f"✅ Calculated occupancy: {occupancy_rate*100:.1f}%")
        
        return {
            'occupancy_rate': occupancy_rate,
            'occupied_count': occupied,
            'vacant_count': vacant,
            'total_spaces': len(items),
            'average_confidence': avg_confidence,
            'status': 'CRITICAL' if occupancy_rate > 0.95 else 'HIGH' if occupancy_rate > 0.80 else 'NORMAL'
        }
    except Exception as e:
        logger.error(f"❌ Error calculating statistics: {str(e)}")
        return {'error': str(e)}


def lambda_handler(event, context):
    """
    API Gateway Handler para lectura de datos.
    
    Rutas soportadas:
    - GET /status → Todos los espacios
    - GET /status?space_id=A-01 → Espacio específico
    - GET /status/occupied → Espacios ocupados
    - GET /status/vacant → Espacios libres
    - GET /status/stats → Estadísticas
    """
    try:
        logger.info("📨 read_status triggered")
        
        # Obtener ruta y parámetros
        path = event.get('path', '/status').lower()
        query_params = event.get('queryStringParameters', {}) or {}
        
        # Enrutar según path/parámetros
        if query_params.get('space_id'):
            # GET /status?space_id=A-01
            data = get_space_by_id(query_params['space_id'])
        elif path.endswith('/occupied') or path.endswith('occupied'):
            # GET /status/occupied
            data = get_occupied_spaces()
        elif path.endswith('/vacant') or path.endswith('vacant'):
            # GET /status/vacant
            data = get_vacant_spaces()
        elif path.endswith('/stats') or path.endswith('statistics'):
            # GET /status/stats
            data = get_occupancy_statistics()
        else:
            # GET /status (default)
            data = get_all_spaces()
        
        return {
            'statusCode': 200,
            'body': json.dumps(data, default=decimal_to_float),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
    
    except Exception as e:
        logger.error(f"❌ Error in read_status: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)}),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
