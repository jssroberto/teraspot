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

import lambda_function

def test_history_archival():
    print("Testing History Archival Logic...")
    
    event = {
        'Records': [
            {
                'eventName': 'INSERT',
                'dynamodb': {
                    'NewImage': {
                        'space_id': {'S': 'space-101'},
                        'timestamp': {'S': '2023-10-27T10:00:00Z'},
                        'status': {'S': 'occupied'},
                        'confidence': {'N': '0.95'},
                        'device_id': {'S': 'cam-01'}
                    }
                }
            }
        ]
    }
    
    lambda_function.lambda_handler(event, None)
    
    lambda_function.history_table.put_item.assert_called_once()
    
    from decimal import Decimal
    
    call_args = lambda_function.history_table.put_item.call_args
    item = call_args.kwargs['Item']
    
    print(f"📦 Captured Item: {item}")
    
    assert item['space_id'] == 'space-101', f"Expected space-101, got {item['space_id']}"
    assert item['status'] == 'occupied', f"Expected occupied, got {item['status']}"
    assert item['confidence'] == Decimal('0.95'), f"Expected 0.95, got {item['confidence']}"
    assert 'archived_at' in item, "Missing archived_at timestamp"
    
    print("Success! Item was archived to history table.")

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
        test_history_archival()
        test_low_confidence_alert()
        print("\nAll local tests passed!")
    except AssertionError as e:
        print(f"\nTest Failed: {e}")
    except Exception as e:
        print(f"\nError: {e}")
