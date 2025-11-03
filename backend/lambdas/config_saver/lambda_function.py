import json
import logging
import os
import boto3
from datetime import datetime
from typing import Dict, Any, Tuple

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuración
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
CONFIG_TABLE_NAME = os.getenv('CONFIG_TABLE_NAME', 'teraspot-config-dev')

dynamodb = boto3.resource('dynamodb', region_name=AWS_REGION)
config_table = dynamodb.Table(CONFIG_TABLE_NAME)


def validate_config(config: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Valida que la configuración cumpla con esquema requerido.
    """
    # Campos requeridos
    required_fields = ['config_id', 'config_type', 'value']
    for field in required_fields:
        if field not in config:
            return False, f"Missing required field: {field}"
    
    # Tipos válidos
    valid_types = ['threshold', 'zone', 'device', 'alert_rule']
    if config.get('config_type') not in valid_types:
        return False, f"Invalid config_type. Must be one of: {valid_types}"
    
    # Validar por tipo
    config_type = config.get('config_type')
    
    if config_type == 'threshold':
        # Thresholds deben tener números
        value = config.get('value', {})
        if not isinstance(value, dict):
            return False, "threshold value must be a dict with numeric values"
    
    elif config_type == 'zone':
        # Zones deben tener nombre y cantidad de espacios
        value = config.get('value', {})
        if 'name' not in value or 'total_spaces' not in value:
            return False, "zone must have 'name' and 'total_spaces'"
    
    elif config_type == 'device':
        # Devices deben tener ip y puerto
        value = config.get('value', {})
        if 'ip' not in value or 'port' not in value:
            return False, "device must have 'ip' and 'port'"
    
    return True, ""


def save_config(config: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Guarda configuración en DynamoDB.
    """
    try:
        # Validar
        is_valid, error_msg = validate_config(config)
        if not is_valid:
            logger.warning(f"⚠️ Config validation failed: {error_msg}")
            return False, error_msg
        
        # Construir item
        item = {
            'config_id': config.get('config_id'),
            'config_type': config.get('config_type'),
            'value': config.get('value'),
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'version': config.get('version', 1),
            'updated_by': config.get('updated_by', 'system'),
            'active': config.get('active', True)
        }
        
        # Guardar
        config_table.put_item(Item=item)
        logger.info(f"✅ Saved config: {config.get('config_id')} (type: {config.get('config_type')})")
        
        return True, f"Config {config.get('config_id')} saved successfully"
    
    except Exception as e:
        logger.error(f"❌ Failed to save config: {str(e)}")
        return False, str(e)


def get_config(config_id: str) -> Dict[str, Any]:
    """
    Obtiene configuración por ID.
    """
    try:
        response = config_table.get_item(Key={'config_id': config_id})
        return response.get('Item', {})
    except Exception as e:
        logger.error(f"❌ Failed to get config {config_id}: {str(e)}")
        return {}


def get_configs_by_type(config_type: str) -> list:
    """
    Obtiene todas las configuraciones de un tipo específico.
    """
    try:
        response = config_table.scan(
            FilterExpression='config_type = :type',
            ExpressionAttributeValues={':type': config_type}
        )
        return response.get('Items', [])
    except Exception as e:
        logger.error(f"❌ Failed to get configs by type {config_type}: {str(e)}")
        return []


def lambda_handler(event, context):
    """
    Maneja CRUD de configuraciones.
    Actions: SAVE, GET, LIST, DELETE
    """
    try:
        logger.info("📨 config_saver triggered")
        
        # Parsear payload
        if 'body' in event:
            payload = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            payload = event
        
        action = payload.get('action', 'SAVE').upper()
        
        # SAVE: Guardar nueva configuración
        if action == 'SAVE':
            config = payload.get('config', {})
            success, message = save_config(config)
            
            return {
                'statusCode': 200 if success else 400,
                'body': json.dumps({
                    'message': message,
                    'config_id': config.get('config_id'),
                    'success': success
                })
            }
        
        # GET: Obtener configuración por ID
        elif action == 'GET':
            config_id = payload.get('config_id')
            if not config_id:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'config_id required'})
                }
            
            config = get_config(config_id)
            return {
                'statusCode': 200,
                'body': json.dumps({'config': config}, default=str)
            }
        
        # LIST: Listar por tipo
        elif action == 'LIST':
            config_type = payload.get('config_type')
            if not config_type:
                return {
                    'statusCode': 400,
                    'body': json.dumps({'error': 'config_type required'})
                }
            
            configs = get_configs_by_type(config_type)
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'config_type': config_type,
                    'count': len(configs),
                    'items': configs
                }, default=str)
            }
        
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': f'Unknown action: {action}'})
            }
    
    except Exception as e:
        logger.error(f"❌ Error in config_saver: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
