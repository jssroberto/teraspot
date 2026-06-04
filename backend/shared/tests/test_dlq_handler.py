import json
from unittest.mock import MagicMock, patch
import pytest

from utils.dlq__handler import sendMessageDLQ

class TestDLQHandler:
    """Unit tests for the shared Dead-Letter Queue (DLQ) SQS publisher"""

    @patch("utils.dlq__handler.QUEUE_URL", None)
    @patch("utils.dlq__handler.logger")
    @patch("utils.dlq__handler.boto3.client")
    def test_send_message_dlq_missing_url(self, mock_boto_client, mock_logger):
        """Test: Exit early and log error without calling boto3 if SQS_URL is unset"""
        payload = {"error": "Test failure reason", "message": "hello"}
        
        sendMessageDLQ(payload)
        
        # Verify early return
        mock_logger.error.assert_called_once_with("ERROR: SQS_URL environment variable is not defined.")
        mock_boto_client.assert_not_called()

    @patch("utils.dlq__handler.QUEUE_URL", "https://sqs.us-east-1.amazonaws.com/123456789012/test-dlq")
    @patch("utils.dlq__handler.boto3.client")
    def test_send_message_dlq_success(self, mock_boto_client):
        """Test: Instantiate boto3 SQS client and post correctly-serialized message payload"""
        mock_sqs = MagicMock()
        mock_sqs.send_message.return_value = {"MessageId": "msg-12345"}
        mock_boto_client.return_value = mock_sqs
        
        payload = {"error": "Test error", "payload": "raw data"}
        sendMessageDLQ(payload)
        
        # Assert SQS client initialized with correct region
        mock_boto_client.assert_called_once_with("sqs", region_name="us-east-1")
        
        # Assert message passed successfully with proper params
        mock_sqs.send_message.assert_called_once_with(
            QueueUrl="https://sqs.us-east-1.amazonaws.com/123456789012/test-dlq",
            MessageBody=json.dumps(payload)
        )
