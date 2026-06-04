import json
from unittest.mock import patch

import boto3
import pytest
from config_saver_handler import lambda_handler, validate_config
from moto import mock_aws

# ============ TESTS WITHOUT MOCK (Validation) ============


def test_validate_config_valid_zone():
    """Test successful zone validation"""
    config = {
        "config_type": "zone",
        "facility_id": "f1",
        "zone_id": "z1",
        "value": {"name": "Zone A", "total_spaces": 50},
    }
    is_valid, error = validate_config(config)
    assert is_valid is True
    assert error == ""


def test_validate_config_missing_field():
    """Test validation with missing field"""
    config = {"config_type": "zone"}  # Missing value
    is_valid, error = validate_config(config)
    assert is_valid is False
    assert "Missing required field" in error


def test_validate_config_invalid_type():
    """Test invalid configuration type"""
    config = {"config_type": "invalid_type", "value": {}}
    is_valid, error = validate_config(config)
    assert is_valid is False


def test_validate_config_zone_missing_fields():
    """Test zone without required fields"""
    # Missing facility_id/zone_id
    config = {"config_type": "zone", "value": {"name": "Zone A", "total_spaces": 10}}
    is_valid, error = validate_config(config)
    assert is_valid is False
    assert "zone must have 'facility_id' and 'zone_id'" in error

    # Missing value fields
    config = {
        "config_type": "zone",
        "facility_id": "f1",
        "zone_id": "z1",
        "value": {"name": "Zone A"},  # Missing total_spaces
    }
    is_valid, error = validate_config(config)
    assert is_valid is False
    assert "total_spaces" in error


def test_validate_config_device():
    """Test device validation"""
    config = {
        "config_type": "device",
        "device_id": "cam-01",
        "value": {"ip": "192.168.1.100", "port": 5000},
    }
    is_valid, error = validate_config(config)
    assert is_valid is True


# ============ TESTS WITH MOCK (Handler) ============


@pytest.fixture
def s3_setup():
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="teraspot-config-dev")
        yield s3


def test_lambda_handler_save(s3_setup):
    """Test SAVE handler with simulated S3"""

    event = {
        "action": "SAVE",
        "config": {
            "config_type": "zone",
            "facility_id": "f1",
            "zone_id": "z1",
            "value": {"name": "Test Zone", "total_spaces": 25},
        },
    }

    with patch("config_saver_handler.s3_client", s3_setup):
        result = lambda_handler(event, None)

    assert result["statusCode"] == 200

    # Check response body for config_id
    body = json.loads(result["body"])
    assert body["config_id"] == "roi-f1-z1"

    # Verify that it was saved in S3
    response = s3_setup.get_object(
        Bucket="teraspot-config-dev", Key="configs/roi-f1-z1.json"
    )
    content = json.loads(response["Body"].read().decode("utf-8"))
    assert content["config_id"] == "roi-f1-z1"
    assert content["value"]["name"] == "Test Zone"
    assert content["updated_by"] == "system"  # Default check


def test_lambda_handler_list(s3_setup):
    """Test LIST handler"""
    # Create some test files
    config1 = {
        "config_id": "roi-f1-z1",
        "config_type": "zone",
        "facility_id": "f1",
        "zone_id": "z1",
        "value": {"name": "Zone 1", "total_spaces": 10},
    }
    config2 = {
        "config_id": "roi-f1-z2",
        "config_type": "zone",
        "facility_id": "f1",
        "zone_id": "z2",
        "value": {"name": "Zone 2", "total_spaces": 20},
    }
    config3 = {
        "config_id": "device-1",
        "config_type": "device",
        "device_id": "1",
        "value": {"ip": "1.1.1.1", "port": 80},
    }

    s3_setup.put_object(
        Bucket="teraspot-config-dev",
        Key="configs/roi-f1-z1.json",
        Body=json.dumps(config1),
    )
    s3_setup.put_object(
        Bucket="teraspot-config-dev",
        Key="configs/roi-f1-z2.json",
        Body=json.dumps(config2),
    )
    s3_setup.put_object(
        Bucket="teraspot-config-dev",
        Key="configs/device-1.json",
        Body=json.dumps(config3),
    )

    event = {"action": "LIST", "config_type": "zone"}
    with patch("config_saver_handler.s3_client", s3_setup):
        result = lambda_handler(event, None)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["count"] == 2
    assert len(body["items"]) == 2
    ids = [item["config_id"] for item in body["items"]]
    assert "roi-f1-z1" in ids
    assert "roi-f1-z2" in ids
    assert "device-1" not in ids


def test_lambda_handler_get(s3_setup):
    """Test GET handler"""
    config = {
        "config_id": "roi-f1-zget",
        "config_type": "zone",
        "facility_id": "f1",
        "zone_id": "zget",
        "value": {"name": "Zone Get", "total_spaces": 5},
    }
    s3_setup.put_object(
        Bucket="teraspot-config-dev",
        Key="configs/roi-f1-zget.json",
        Body=json.dumps(config),
    )

    event = {"action": "GET", "config_id": "roi-f1-zget"}
    with patch("config_saver_handler.s3_client", s3_setup):
        result = lambda_handler(event, None)

    assert result["statusCode"] == 200
    body = json.loads(result["body"])
    assert body["config"]["config_id"] == "roi-f1-zget"


def test_lambda_handler_invalid_action():
    """Test invalid action"""
    event = {"action": "INVALID"}
    result = lambda_handler(event, None)
    assert result["statusCode"] == 400
