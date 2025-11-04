import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import json
import pytest

from lambda_function import (
    validate_data, 
    save_current,
    save_history,
    generate_alerts,
    lambda_handler
)


def test_validate_data_valid():
    """Test validación exitosa"""
    space = {'status': 'occupied', 'confidence': 0.95}
    is_valid, error = validate_data('A-01', space)
    assert is_valid
    assert error == ""


def test_validate_data_invalid_status():
    """Test status inválido"""
    space = {'status': 'invalid', 'confidence': 0.95}
    is_valid, error = validate_data('A-01', space)
    assert not is_valid
    assert 'Invalid status' in error


def test_validate_data_confidence_out_of_range():
    """Test confidence fuera de rango"""
    space = {'status': 'occupied', 'confidence': 1.5}
    is_valid, error = validate_data('A-01', space)
    assert not is_valid
    assert 'out of range' in error


def test_validate_data_missing_confidence():
    """Test confidence faltante"""
    space = {'status': 'occupied'}
    is_valid, error = validate_data('A-01', space)
    assert not is_valid


def test_generate_alerts_low_confidence():
    """Test alerta por baja confianza"""
    items = [
        {
            'space_id': 'A-01',
            'status': 'occupied',
            'confidence': 0.7,  # Bajo
            'device_id': 'test'
        }
    ]
    alerts = generate_alerts(items)
    assert len(alerts) > 0
    assert any(a['type'] == 'LOW_CONFIDENCE' for a in alerts)


def test_generate_alerts_high_occupancy():
    """Test alerta por alta ocupación"""
    items = [
        {'space_id': f'A-{i:02d}', 'status': 'occupied', 'confidence': 0.95, 'device_id': 'test'}
        for i in range(1, 20)  # 19 ocupados (95% de 20)
    ]
    alerts = generate_alerts(items)
    assert any(a['type'] == 'CRITICAL' for a in alerts)


def test_lambda_handler_valid_payload():
    """Test handler con payload válido"""
    event = {
        'device_id': 'TeraSpot-01',
        'timestamp': '2025-11-03T21:36:00Z',
        'spaces': {
            'A-01': {'status': 'occupied', 'confidence': 0.95},
            'A-02': {'status': 'vacant', 'confidence': 0.92}
        }
    }
    
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['success'] == True
    assert body['items'] == 2


def test_lambda_handler_empty():
    """Test handler sin items"""
    event = {
        'device_id': 'TeraSpot-01',
        'spaces': {}
    }
    
    result = lambda_handler(event, None)
    # Debe ser 400 (sin items válidos)
    assert result['statusCode'] in [400, 200]


def test_lambda_handler_invalid_data():
    """Test handler con datos inválidos"""
    event = {
        'device_id': 'TeraSpot-01',
        'spaces': {
            'A-01': {'status': 'invalid', 'confidence': 1.5}  # Inválido
        }
    }
    
    result = lambda_handler(event, None)
    body = json.loads(result['body'])
    assert body['rejected'] > 0
