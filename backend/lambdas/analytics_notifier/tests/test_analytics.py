import json
import os
import sys
from unittest.mock import patch

import pytest

# Fix imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analytics_notifier_handler import lambda_handler, send_to_sqs


class TestAnalyticsNotifier:
    """Unit tests for analytics_notifier Lambda"""

    @patch("analytics_notifier_handler.sqs")
    def test_send_to_sqs_success(self, mock_sqs):
        """Test: Successfully send message to SQS"""
        mock_sqs.send_message.return_value = {"MessageId": "test-msg-123"}

        message = {
            "type": "LOW_CONFIDENCE",
            "space_id": "A1",
            "confidence": 0.72,
            "severity": "WARNING",
        }

        result = send_to_sqs(
            "https://sqs.us-east-1.amazonaws.com/123456/queue", message
        )

        assert result
        mock_sqs.send_message.assert_called_once()

    @patch("analytics_notifier_handler.sqs")
    def test_send_to_sqs_failure(self, mock_sqs):
        """Test: Failed to send to SQS"""
        mock_sqs.send_message.side_effect = Exception("Connection error")

        message = {"type": "TEST", "severity": "INFO"}
        result = send_to_sqs(
            "https://sqs.us-east-1.amazonaws.com/123456/queue", message
        )

        assert not result

    @patch("analytics_notifier_handler.sqs")
    def test_lambda_handler_low_confidence_alert(self, mock_sqs):
        """Test: Handler processes low confidence alert"""
        mock_sqs.send_message.return_value = {"MessageId": "test-456"}

        event = {
            "Records": [
                {
                    "eventName": "INSERT",
                    "dynamodb": {
                        "NewImage": {
                            "space_id": {"S": "A1"},
                            "status": {"S": "occupied"},
                            "confidence": {"N": "0.72"},
                            "timestamp": {"S": "2025-11-04T09:00:00Z"},
                        }
                    },
                }
            ]
        }

        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["success"]

    @patch("analytics_notifier_handler.sqs")
    def test_lambda_handler_high_occupancy(self, mock_sqs):
        """Test: Handler detects high occupancy"""
        mock_sqs.send_message.return_value = {"MessageId": "test-789"}

        # Simulate 95% occupancy
        records = [
            {
                "eventName": "INSERT",
                "dynamodb": {
                    "NewImage": {
                        "space_id": {"S": f"A{i}"},
                        "status": {"S": "occupied" if i < 19 else "vacant"},
                        "confidence": {"N": "0.95"},
                        "timestamp": {"S": "2025-11-04T09:00:00Z"},
                    }
                },
            }
            for i in range(20)
        ]

        event = {"Records": records}
        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["success"]

    @patch("analytics_notifier_handler.sqs")
    def test_lambda_handler_empty_records(self, mock_sqs):
        """Test: Handler with empty records"""
        event = {"Records": []}

        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert body["success"]

    @patch("analytics_notifier_handler.sqs")
    def test_lambda_handler_missing_event(self, mock_sqs):
        """Test: Handler with missing Records key"""
        event = {}

        result = lambda_handler(event, None)

        assert result["statusCode"] == 400

    @patch("analytics_notifier_handler.sqs")
    def test_lambda_handler_error_handling(self, mock_sqs):
        """Test: Handler error handling"""
        mock_sqs.send_message.side_effect = Exception("SQS Error")

        event = {
            "Records": [
                {
                    "eventName": "INSERT",
                    "dynamodb": {
                        "NewImage": {
                            "space_id": {"S": "A1"},
                            "status": {"S": "occupied"},
                            "confidence": {"N": "0.75"},
                            "timestamp": {"S": "2025-11-04T09:00:00Z"},
                        }
                    },
                }
            ]
        }

        # Should handle exception gracefully
        result = lambda_handler(event, None)
        assert result["statusCode"] in [200, 500]

    @patch("analytics_notifier_handler.sqs")
    def test_lambda_handler_modify_event(self, mock_sqs):
        """Test: Handler processes MODIFY events"""
        mock_sqs.send_message.return_value = {"MessageId": "test-modify"}

        event = {
            "Records": [
                {
                    "eventName": "MODIFY",
                    "dynamodb": {
                        "NewImage": {
                            "space_id": {"S": "B5"},
                            "status": {"S": "vacant"},
                            "confidence": {"N": "0.88"},
                            "timestamp": {"S": "2025-11-04T09:00:00Z"},
                        }
                    },
                }
            ]
        }

        result = lambda_handler(event, None)

        assert result["statusCode"] == 200


# Additional edge case tests
class TestAnalyticsNotifierEdgeCases:
    """Edge case tests"""

    @patch("analytics_notifier_handler.sqs")
    def test_boundary_confidence_80_percent(self, mock_sqs):
        """Test: Confidence at exact 0.80 boundary (not low)"""
        event = {
            "Records": [
                {
                    "eventName": "INSERT",
                    "dynamodb": {
                        "NewImage": {
                            "space_id": {"S": "C1"},
                            "status": {"S": "occupied"},
                            "confidence": {"N": "0.80"},
                            "timestamp": {"S": "2025-11-04T09:00:00Z"},
                        }
                    },
                }
            ]
        }

        result = lambda_handler(event, None)
        assert result["statusCode"] == 200

    @patch("analytics_notifier_handler.sqs")
    def test_boundary_confidence_79_percent(self, mock_sqs):
        """Test: Confidence just below boundary (low)"""
        mock_sqs.send_message.return_value = {"MessageId": "test-boundary"}

        event = {
            "Records": [
                {
                    "eventName": "INSERT",
                    "dynamodb": {
                        "NewImage": {
                            "space_id": {"S": "C2"},
                            "status": {"S": "occupied"},
                            "confidence": {"N": "0.79"},
                            "timestamp": {"S": "2025-11-04T09:00:00Z"},
                        }
                    },
                }
            ]
        }

        result = lambda_handler(event, None)
        assert result["statusCode"] == 200

    @patch("analytics_notifier_handler.sqs")
    @patch("analytics_notifier_handler.current_table")
    @patch("analytics_notifier_handler.history_table")
    def test_scheduled_event_health_check(self, mock_history, mock_current, mock_sqs):
        """Test: Health check detects dead sensors"""
        from datetime import datetime, timedelta, timezone

        # Setup mock data
        now = datetime.now(timezone.utc)
        stale_time = (now - timedelta(minutes=10)).isoformat()
        fresh_time = now.isoformat()

        mock_current.scan.return_value = {
            "Items": [
                {
                    "space_id": "A1",
                    "device_id": "dev1",
                    "last_heartbeat": stale_time,
                    "is_alive": True,
                },
                {
                    "space_id": "A2",
                    "device_id": "dev2",
                    "last_heartbeat": fresh_time,
                    "is_alive": True,
                },
                {
                    "space_id": "A3",
                    "device_id": "dev3",
                    "last_heartbeat": stale_time,
                    "is_alive": False,  # Already dead
                },
            ]
        }

        event = {"source": "aws.events"}
        result = lambda_handler(event, None)

        assert result["statusCode"] == 200
        body = json.loads(result["body"])
        assert (
            body["inactive_devices"] == 1
        )  # Only A1 should be counted as newly inactive

        # Verify A1 was updated to dead
        mock_current.update_item.assert_called_once()
        call_args = mock_current.update_item.call_args
        assert call_args[1]["Key"] == {"space_id": "A1"}
        assert call_args[1]["ExpressionAttributeValues"][":val"] is False

        # Verify A1 was written to history
        # Verify A1 was written to history (Status update + Alert history)
        assert mock_history.put_item.call_count == 2

        # Verify the 'dead' status record exists in the calls
        calls = mock_history.put_item.call_args_list
        dead_status_found = False
        for call in calls:
            item = call[1]["Item"]
            if item.get("space_id") == "A1" and item.get("status") == "dead":
                dead_status_found = True
                break

        assert dead_status_found, "Dead status record not found in history calls"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
