import json
import pytest
from decimal import Decimal
from lambda_function import (
    get_all_spaces,
    get_space_by_id,
    get_occupancy_statistics,
    decimal_to_float,
    lambda_handler
)


def test_decimal_to_float():
    """Test conversión Decimal a float"""
    value = Decimal('0.95')
    result = decimal_to_float(value)
    assert result == 0.95
    assert isinstance(result, float)


def test_lambda_handler_all_spaces():
    """Test obtener todos los espacios"""
    event = {
        'path': '/status',
        'httpMethod': 'GET'
    }
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert 'spaces' in body or 'error' in body


def test_lambda_handler_by_space_id():
    """Test obtener espacio por ID"""
    event = {
        'path': '/status',
        'httpMethod': 'GET',
        'queryStringParameters': {'space_id': 'A-01'}
    }
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200


def test_lambda_handler_occupied():
    """Test obtener espacios ocupados"""
    event = {
        'path': '/status/occupied',
        'httpMethod': 'GET'
    }
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert 'occupied_spaces' in body or 'error' in body


def test_lambda_handler_vacant():
    """Test obtener espacios libres"""
    event = {
        'path': '/status/vacant',
        'httpMethod': 'GET'
    }
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200


def test_lambda_handler_statistics():
    """Test obtener estadísticas"""
    event = {
        'path': '/status/stats',
        'httpMethod': 'GET'
    }
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert 'occupancy_rate' in body or 'error' in body


def test_lambda_handler_cors_headers():
    """Test headers CORS incluidos"""
    event = {
        'path': '/status',
        'httpMethod': 'GET'
    }
    result = lambda_handler(event, None)
    assert 'Access-Control-Allow-Origin' in result['headers']
    assert result['headers']['Access-Control-Allow-Origin'] == '*'
