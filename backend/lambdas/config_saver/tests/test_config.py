import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import json
import pytest
import boto3
from moto import mock_dynamodb
from lambda_function import (
    validate_config,
    lambda_handler
)


# ============ TESTS SIN MOCK (Validación) ============

def test_validate_config_valid_zone():
    """Test validación exitosa de zona"""
    config = {
        'config_id': 'zone-a',
        'config_type': 'zone',
        'value': {'name': 'Zone A', 'total_spaces': 50}
    }
    is_valid, error = validate_config(config)
    assert is_valid is True
    assert error == ""


def test_validate_config_missing_field():
    """Test validación con campo faltante"""
    config = {
        'config_id': 'zone-a',
        'config_type': 'zone'
    }
    is_valid, error = validate_config(config)
    assert is_valid is False
    assert 'Missing required field' in error


def test_validate_config_invalid_type():
    """Test tipo de configuración inválido"""
    config = {
        'config_id': 'test',
        'config_type': 'invalid_type',
        'value': {}
    }
    is_valid, error = validate_config(config)
    assert is_valid is False


def test_validate_config_zone_missing_fields():
    """Test zona sin campos requeridos"""
    config = {
        'config_id': 'zone-a',
        'config_type': 'zone',
        'value': {'name': 'Zone A'}
    }
    is_valid, error = validate_config(config)
    assert is_valid is False


def test_validate_config_device():
    """Test validación de dispositivo"""
    config = {
        'config_id': 'device-01',
        'config_type': 'device',
        'value': {'ip': '192.168.1.100', 'port': 5000}
    }
    is_valid, error = validate_config(config)
    assert is_valid is True


# ============ TESTS CON MOCK (Handler) ============

@mock_dynamodb
def test_lambda_handler_save():
    """Test handler SAVE con DynamoDB simulado"""
    # Setup: Crear tabla mock
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    dynamodb.create_table(
        TableName='teraspot-config-dev',
        KeySchema=[{'AttributeName': 'config_id', 'KeyType': 'HASH'}],
        AttributeDefinitions=[{'AttributeName': 'config_id', 'AttributeType': 'S'}],
        BillingMode='PAY_PER_REQUEST'
    )
    
    # Test event
    event = {
        'action': 'SAVE',
        'config': {
            'config_id': 'zone-test',
            'config_type': 'zone',
            'value': {
                'name': 'Test Zone',
                'total_spaces': 25
            }
        }
    }
    
    # Execute
    result = lambda_handler(event, None)
    
    # Assert
    print(f"Result: {result}")  # Debug
    assert result['statusCode'] == 200, f"Expected 200, got {result['statusCode']}"
    body = json.loads(result['body'])
    assert body['success'] is True, f"Expected success=True, got {body}"
    assert body['config_id'] == 'zone-test'


@mock_dynamodb
def test_lambda_handler_list():
    """Test handler LIST"""
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    dynamodb.create_table(
        TableName='teraspot-config-dev',
        KeySchema=[{'AttributeName': 'config_id', 'KeyType': 'HASH'}],
        AttributeDefinitions=[{'AttributeName': 'config_id', 'AttributeType': 'S'}],
        BillingMode='PAY_PER_REQUEST'
    )
    
    event = {
        'action': 'LIST',
        'config_type': 'zone'
    }
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert 'items' in body


def test_lambda_handler_invalid_action():
    """Test action inválida"""
    event = {'action': 'INVALID'}
    result = lambda_handler(event, None)
    assert result['statusCode'] == 400
