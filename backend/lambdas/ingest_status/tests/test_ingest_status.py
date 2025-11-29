import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import json

import pytest

from ingest_status import lambda_function
from ingest_status.parser import parse_events
from ingest_status.qa import validate_data

lambda_handler = lambda_function.lambda_handler


class DummyTable:
    def __init__(self):
        self.items = []

    def put_item(self, Item=None, **kwargs):
        self.items.append(Item or kwargs.get("Item"))


@pytest.fixture(autouse=True)
def mock_dependencies(monkeypatch):
    current_table = DummyTable()

    saved_alerts = {"alerts": []}

    monkeypatch.setattr(lambda_function, "current_table", current_table)

    def fake_save_current(items, table):
        table.items.extend(items)

    monkeypatch.setattr(lambda_function, "save_current", fake_save_current)

    return {
        "current_table": current_table,
        "alerts": saved_alerts,
    }


def test_parse_events_accepts_legacy_snapshot():
    payload = {
        "device_id": "device-1",
        "timestamp": "2025-11-03T21:36:00Z",
        "spaces": {
            "A-01": {"status": "occupied", "confidence": 0.95},
            "A-02": {"status": "vacant", "confidence": 0.9},
        },
    }
    events = parse_events(payload)
    assert len(events) == 2
    assert events[0]["device_id"] == "device-1"


def test_parse_events_from_list():
    payload = [
        {"space_id": "A-01", "status": "occupied", "confidence": 0.9},
        {"space_id": "A-02", "status": "vacant", "confidence": 0.95},
    ]
    events = parse_events(payload)
    assert len(events) == 2
    assert events[1]["space_id"] == "A-02"


def test_validate_data_valid():
    """Test validación exitosa"""
    space = {"status": "occupied", "confidence": 0.95}
    is_valid, error = validate_data("A-01", space)
    assert is_valid
    assert error == ""


def test_validate_data_invalid_status():
    """Test status inválido"""
    space = {"status": "invalid", "confidence": 0.95}
    is_valid, error = validate_data("A-01", space)
    assert not is_valid
    assert "Invalid status" in error


def test_validate_data_confidence_out_of_range():
    """Test confidence fuera de rango"""
    space = {"status": "occupied", "confidence": 1.5}
    is_valid, error = validate_data("A-01", space)
    assert not is_valid
    assert "out of range" in error


def test_validate_data_missing_confidence():
    """Test confidence faltante"""
    space = {"status": "occupied"}
    is_valid, error = validate_data("A-01", space)
    assert not is_valid


def test_lambda_handler_valid_payload():
    """Test handler con payload válido"""
    event = [
        {
            "space_id": "A-01",
            "status": "occupied",
            "confidence": 0.95,
            "device_id": "dev-1",
        },
        {
            "space_id": "A-02",
            "status": "vacant",
            "confidence": 0.9,
            "device_id": "dev-1",
        },
    ]

    result = lambda_handler(event, None)
    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["success"]
    assert body["items"] == 2


def test_lambda_handler_empty():
    """Test handler sin items"""
    event = {"spaces": {}}

    result = lambda_handler(event, None)
    assert result["statusCode"] in [400, 200]


def test_lambda_handler_invalid_data():
    """Test handler con datos inválidos"""
    event = [{"space_id": "A-01", "status": "invalid", "confidence": 1.5}]

    result = lambda_handler(event, None)
    body = json.loads(result["body"])
    assert body["rejected"] > 0
