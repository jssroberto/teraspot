import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import json
import pytest
from lambda_function import (
    validate_quality,
    check_alerts,
    build_items,
    lambda_handler
)


def test_validate_quality_valid():
    """Test validación exitosa"""
    space = {'status': 'occupied', 'confidence': 0.95}
    is_valid, error = validate_quality('A-01', space)
    assert is_valid
    assert error == ""


def test_validate_quality_invalid_status():
    """Test status inválido"""
    space = {'status': 'invalid', 'confidence': 0.95}
    is_valid, error = validate_quality('A-01', space)
    assert not is_valid
    assert 'Invalid status' in error


def test_validate_quality_confidence_out_of_range():
    """Test confidence fuera de rango"""
    space = {'status': 'occupied', 'confidence': 1.5}
    is_valid, error = validate_quality('A-01', space)
    assert not is_valid
    assert 'out of range' in error


def test_validate_quality_missing_confidence():
    """Test confidence faltante"""
    space = {'status': 'occupied'}
    is_valid, error = validate_quality('A-01', space)
    assert not is_valid


def test_check_alerts_low_confidence():
    """Test alerta por baja confianza"""
    alerts = check_alerts('A-01', 'occupied', 0.7, 10, 5)
    assert len(alerts) > 0
    assert alerts[0]['type'] == 'LOW_CONFIDENCE'


def test_check_alerts_high_occupancy():
    """Test alerta por alta ocupación"""
    alerts = check_alerts('A-01', 'occupied', 0.95, 10, 9)  # 90% ocupado
    assert any(a['type'] == 'HIGH_OCCUPANCY' for a in alerts)


def test_build_items_valid():
    """Test construcción de items válidos"""
    payload = {
        'spaces': {
            'A-01': {'status': 'occupied', 'confidence': 0.95},
            'A-02': {'status': 'vacant', 'confidence': 0.92}
        },
        'timestamp': '2025-11-03T21:36:00Z',
        'device_id': 'TeraSpot-01'
    }
    items = build_items(payload)
    assert len(items) == 2
    assert items[0]['space_id'] == 'A-01'


def test_lambda_handler_success():
    """Test handler exitoso"""
    with open('event.json') as f:
        event = json.load(f)
    
    result = lambda_handler(event, None)
    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert 'items_processed' in body
    assert 'alerts_count' in body

