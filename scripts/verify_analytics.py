import sys
import os
import json
import logging
from unittest.mock import MagicMock, patch

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend/lambdas/analytics_notifier')))

os.environ['SQS_ALERTS_URL'] = 'https://sqs.us-east-1.amazonaws.com/123456789012/alerts'
os.environ['SQS_LOW_CONFIDENCE_URL'] = 'https://sqs.us-east-1.amazonaws.com/123456789012/low-confidence'
os.environ['DLQ_URL'] = 'https://sqs.us-east-1.amazonaws.com/123456789012/dlq'
os.environ['HISTORY_TABLE'] = 'parking-history'

mock_boto3 = MagicMock()
mock_resource = MagicMock()
mock_client = MagicMock()
mock_boto3.resource.return_value = mock_resource
mock_boto3.client.return_value = mock_client
sys.modules['boto3'] = mock_boto3

mock_table = MagicMock()
mock_resource.Table.return_value = mock_table

mock_sqs = MagicMock()
mock_client.send_message.return_value = {'MessageId': '123'}
import analytics_notifier_handler as lambda_function

# test_history_archival removed as stream history archival is now handled by ingest_status

def test_low_confidence_alert():
    print("\n🧪 Testing Low Confidence Alert...")
    
    event = {
        'Records': [
            {
                'eventName': 'MODIFY',
                'dynamodb': {
                    'NewImage': {
                        'space_id': {'S': 'space-102'},
                        'timestamp': {'S': '2023-10-27T10:05:00Z'},
                        'status': {'S': 'occupied'},
                        'confidence': {'N': '0.50'}, 
                        'device_id': {'S': 'cam-01'}
                    }
                }
            }
        ]
    }
    
    lambda_function.lambda_handler(event, None)
    
    lambda_function.sqs.send_message.assert_called()
    print("Success! Low confidence alert sent to SQS.")

if __name__ == "__main__":
    try:
        test_low_confidence_alert()
        print("\nAll local tests passed!")
    except AssertionError as e:
        print(f"\nTest Failed: {e}")
    except Exception as e:
        print(f"\nError: {e}")
