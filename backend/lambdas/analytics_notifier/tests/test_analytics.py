import json
import pytest
from lambda_function import (
    format_alert_html,
    extract_alerts_from_dynamodb_stream,
    lambda_handler
)


def test_format_alert_html():
    """Test formateo de alertas a HTML"""
    alerts = [
        {'severity': 'WARNING', 'type': 'LOW_CONFIDENCE', 'message': 'Test'}
    ]
    html = format_alert_html(alerts)
    assert '<html>' in html
    assert 'TeraSpot' in html
    assert 'WARNING' in html


def test_extract_alerts_from_dynamodb_stream():
    """Test extracción de alertas desde DynamoDB"""
    records = [{
        'dynamodb': {
            'NewImage': {
                'space_id': {'S': 'A-01'},
                'type': {'S': 'LOW_CONFIDENCE'},
                'severity': {'S': 'WARNING'},
                'message': {'S': 'Low confidence'},
                'timestamp': {'S': '2025-11-03T21:36:00Z'}
            }
        }
    }]
    
    alerts = extract_alerts_from_dynamodb_stream(records)
    assert len(alerts) == 1
    assert alerts[0]['space_id'] == 'A-01'


def test_lambda_handler_no_alerts():
    """Test handler sin alertas"""
    event = {}
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['alerts_processed'] == 0


def test_lambda_handler_with_alerts():
    """Test handler con alertas"""
    event = {
        'alerts': [
            {'severity': 'WARNING', 'type': 'LOW_CONFIDENCE', 'message': 'Test alert'}
        ]
    }
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['alerts_processed'] == 1


def test_lambda_handler_direct_payload():
    """Test con payload directo - lectura con UTF-8"""
    # Leer con encoding UTF-8 para soportar emojis
    with open('event.json', encoding='utf-8') as f:
        event = json.load(f)
    
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200


def test_lambda_handler_invalid_event():
    """Test con evento inválido"""
    event = {'invalid': 'data'}
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200


def test_lambda_handler_exception():
    """Test manejo de excepciones"""
    event = None
    result = lambda_handler(event, None)
    assert result['statusCode'] == 500
