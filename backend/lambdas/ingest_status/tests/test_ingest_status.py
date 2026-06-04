import json
import pytest

from ingest_status import ingest_status_handler as lambda_function
from ingest_status import persistence
from ingest_status.parser import parse_events
from ingest_status.qa import validate_data

lambda_handler = lambda_function.lambda_handler


class DummyTable:
    def __init__(self):
        self.items = []

    def put_item(self, Item=None, **kwargs):
        self.items.append(Item or kwargs.get("Item"))
        
    def get_item(self, Key=None, **kwargs):
        # Simple mock: return None or find item
        for item in self.items:
            if item["space_id"] == Key["space_id"]:
                return {"Item": item}
        return {}


@pytest.fixture(autouse=True)
def mock_dependencies(monkeypatch):
    current_table = DummyTable()
    history_table = DummyTable()

    monkeypatch.setattr(lambda_function, "current_table", current_table)
    monkeypatch.setattr(lambda_function, "history_table", history_table)

    # Mock persistence functions
    
    def fake_get_current_state(space_id, table):
        return table.get_item(Key={"space_id": space_id}).get("Item")

    def fake_save_current(items, table):
        for item in items:
            table.put_item(Item=item)

    def fake_save_history(items, table):
        for item in items:
            table.put_item(Item=item)

    # Patch save_current in lambda_function because it is imported at top level
    monkeypatch.setattr(lambda_function, "save_current", fake_save_current)
    
    # Patch others in persistence because they are imported inside the function
    monkeypatch.setattr(persistence, "get_current_state", fake_get_current_state)
    monkeypatch.setattr(persistence, "save_history", fake_save_history)

    return {
        "current_table": current_table,
        "history_table": history_table,
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
    body = json.loads(result["body"])
    print(f"BODY: {body}")
    if result["statusCode"] != 200:
        print(f"FAILED BODY: {body}")
        
    assert result["statusCode"] == 200
    assert body["success"]
    assert body["processed"] == 2
    # First time -> should write history
    assert body["history_writes"] == 2


def test_lambda_handler_cdc_no_change(mock_dependencies):
    """Test CDC: No change -> No history write"""
    current_table = mock_dependencies["current_table"]
    # Pre-populate
    current_table.items.append({
        "space_id": "A-01",
        "status": "occupied",
        "is_alive": True,
        "timestamp": "old_ts"
    })
    
    event = [{
        "space_id": "A-01",
        "status": "occupied", # Same status
        "confidence": 0.95,
        "device_id": "dev-1",
    }]

    result = lambda_handler(event, None)
    body = json.loads(result["body"])
    
    if result["statusCode"] != 200:
        pytest.fail(f"Lambda failed with {result['statusCode']}: {body}")
    
    assert body["processed"] == 1
    assert body["history_writes"] == 0 # Should be 0


def test_lambda_handler_cdc_change(mock_dependencies):
    """Test CDC: Change -> History write"""
    current_table = mock_dependencies["current_table"]
    # Pre-populate
    current_table.items.append({
        "space_id": "A-01",
        "status": "vacant",
        "is_alive": True,
        "timestamp": "old_ts"
    })
    
    event = [{
        "space_id": "A-01",
        "status": "occupied", # Changed
        "confidence": 0.95,
        "device_id": "dev-1",
    }]

    result = lambda_handler(event, None)
    body = json.loads(result["body"])
    
    if result["statusCode"] != 200:
        pytest.fail(f"Lambda failed with {result['statusCode']}: {body}")
    
    assert body["processed"] == 1
    assert body["history_writes"] == 1


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
