import sys
import os
import json
import logging
from unittest.mock import MagicMock, patch

# Add the lambda directory to the path so we can import the function
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend/lambdas/analytics_notifier')))

# Mock environment variables BEFORE importing the lambda
os.environ['SQS_ALERTS_URL'] = 'https://sqs.us-east-1.amazonaws.com/123456789012/alerts'
os.environ['SQS_LOW_CONFIDENCE_URL'] = 'https://sqs.us-east-1.amazonaws.com/123456789012/low-confidence'
os.environ['DLQ_URL'] = 'https://sqs.us-east-1.amazonaws.com/123456789012/dlq'
os.environ['HISTORY_TABLE'] = 'parking-history'

# Mock boto3 via sys.modules BEFORE import
mock_boto3 = MagicMock()
mock_resource = MagicMock()
mock_client = MagicMock()
mock_boto3.resource.return_value = mock_resource
mock_boto3.client.return_value = mock_client
sys.modules['boto3'] = mock_boto3

# Setup DynamoDB Table Mock
mock_table = MagicMock()
mock_resource.Table.return_value = mock_table

# Setup SQS Mock
mock_sqs = MagicMock()
mock_client.send_message.return_value = {'MessageId': '123'}

# Import the lambda function
import lambda_function

# We need to manually inject the mocks into the imported module variables
# because the module level variables (sqs, dynamodb, etc) are initialized at import time
# using the return values of our mocks.
# However, we want to assert on the specific mock instances we created.
# Since we mocked the return values of boto3.resource/client, the module variables
# SHOULD hold our mock objects (mock_resource, mock_sqs).

def test_history_archival():
    print("🧪 Testing History Archival Logic...")
    
    # Simulate a DynamoDB Stream Event (INSERT)
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
    
    # Run Handler
    lambda_function.lambda_handler(event, None)
    
    # Verify put_item was called on history_table
    # We need to access the global 'history_table' in the module, which is now our mock
    lambda_function.history_table.put_item.assert_called_once()
    
    from decimal import Decimal
    
    # Check arguments
    call_args = lambda_function.history_table.put_item.call_args
    item = call_args.kwargs['Item']
    
    print(f"📦 Captured Item: {item}")
    
    assert item['space_id'] == 'space-101', f"Expected space-101, got {item['space_id']}"
    assert item['status'] == 'occupied', f"Expected occupied, got {item['status']}"
    # Compare Decimal to Decimal or string to avoid float precision issues
    assert item['confidence'] == Decimal('0.95'), f"Expected 0.95, got {item['confidence']}"
    assert 'archived_at' in item, "Missing archived_at timestamp"
    
    print("✅ Success! Item was archived to history table.")

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
                        'confidence': {'N': '0.50'}, # Low confidence
                        'device_id': {'S': 'cam-01'}
                    }
                }
            }
        ]
    }
    
    lambda_function.lambda_handler(event, None)
    
    # Verify SQS was called
    lambda_function.sqs.send_message.assert_called()
    print("✅ Success! Low confidence alert sent to SQS.")

if __name__ == "__main__":
    try:
        test_history_archival()
        test_low_confidence_alert()
        print("\n🎉 All local tests passed!")
    except AssertionError as e:
        print(f"\n❌ Test Failed: {e}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
