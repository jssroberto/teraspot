import sys
import os
import json
import pytest
from botocore.exceptions import ClientError

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from ingest_status import lambda_function

lambda_handler = lambda_function.lambda_handler

class MockTable:
    def __init__(self):
        self.items = []

@pytest.fixture
def mock_env(monkeypatch):
    current_table = MockTable()
    history_table = MockTable()
    
    monkeypatch.setattr(lambda_function, "current_table", current_table)
    monkeypatch.setattr(lambda_function, "history_table", history_table)
    
    monkeypatch.setattr(lambda_function, "save_current", lambda items, table: None)
    monkeypatch.setattr(lambda_function, "current_occupancy", lambda table: (0, 0))
    monkeypatch.setattr(lambda_function, "generate_alerts", lambda items, stats: [])
    monkeypatch.setattr(lambda_function, "dispatch_alerts", lambda alerts, sqs, q1, q2: None)

def test_idempotency_duplicate_event(mock_env, monkeypatch):
    def mock_save_history_duplicate(items, table):
        error_response = {'Error': {'Code': 'ConditionalCheckFailedException', 'Message': 'The conditional request failed'}}
        raise ClientError(error_response, 'PutItem')

    monkeypatch.setattr(lambda_function, "save_history", mock_save_history_duplicate)

    event = [
        {'space_id': 'A-01', 'status': 'occupied', 'confidence': 0.95, 'device_id': 'dev-1', 'timestamp': '2025-01-01T00:00:00Z'}
    ]

    result = lambda_handler(event, None)

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['success'] is True
    assert body['message'] == "Duplicate event ignored"
    

def test_idempotency_new_event(mock_env, monkeypatch):
    def mock_save_history_success(items, table):
        pass

    monkeypatch.setattr(lambda_function, "save_history", mock_save_history_success)

    event = [
        {'space_id': 'A-01', 'status': 'occupied', 'confidence': 0.95, 'device_id': 'dev-1', 'timestamp': '2025-01-01T00:00:00Z'}
    ]

    result = lambda_handler(event, None)

    assert result['statusCode'] == 200
    body = json.loads(result['body'])
    assert body['success'] is True
    assert 'message' not in body or body['message'] != "Duplicate event ignored"
