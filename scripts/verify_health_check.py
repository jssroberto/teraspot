import sys
import os
import json
import logging
from unittest.mock import MagicMock
from datetime import datetime, timedelta, timezone

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend/lambdas/analytics_notifier')))

os.environ['SQS_ALERTS_URL'] = 'mock-alerts-queue'
os.environ['SQS_LOW_CONFIDENCE_URL'] = 'mock-low-conf-queue'
os.environ['DLQ_URL'] = 'mock-dlq'
os.environ['HISTORY_TABLE'] = 'parking-history'
os.environ['DYNAMODB_TABLE'] = 'parking-spaces-dev'

mock_boto3 = MagicMock()
mock_resource = MagicMock()
mock_client = MagicMock()
mock_boto3.resource.return_value = mock_resource
mock_boto3.client.return_value = mock_client
sys.modules['boto3'] = mock_boto3
mock_history_table = MagicMock()
mock_current_table = MagicMock()

def get_table_side_effect(name):
    if name == 'parking-history':
        return mock_history_table
    return mock_current_table

mock_resource.Table.side_effect = get_table_side_effect

import analytics_notifier_handler as lambda_function

def test_health_check_inactive_sensor():
    print("Testing Health Check (Inactive Sensor)...")
    
    now = datetime.now(timezone.utc)
    stale_time = (now - timedelta(minutes=10)).isoformat() # 10 mins ago
    active_time = now.isoformat()
    
    mock_current_table.scan.return_value = {
        'Items': [
            {
                'space_id': 'A-01',
                'timestamp': stale_time,
                'device_id': 'device-dead'
            },
            {
                'space_id': 'A-02',
                'timestamp': active_time,
                'device_id': 'device-alive'
            }
        ]
    }
    
    event = {
        'source': 'aws.events',
        'detail-type': 'Scheduled Event'
    }
    
    response = lambda_function.lambda_handler(event, None)
    
    print(f"Response: {response}")
    body = json.loads(response['body'])
    
    assert body['inactive_devices'] == 1, f"Expected 1 inactive device, got {body['inactive_devices']}"
    
    call_args_list = lambda_function.sqs.send_message.call_args_list
    found_alert = False
    for call in call_args_list:
        msg_body = json.loads(call.kwargs['MessageBody'])
        if msg_body.get('type') == 'INACTIVE_SENSOR' and msg_body.get('device_id') == 'device-dead':
            found_alert = True
            print(f"✅ Found Alert: {msg_body['message']}")
            break
            
    assert found_alert, "Did not find INACTIVE_SENSOR alert for device-dead"
    print("\n Success! Health check detected stale sensor.")

def test_occupancy_calculation():
    print("\n Testing Occupancy Calculation (Real-time)...")
    
    items = []
    for i in range(10):
        status = 'occupied' if i < 9 else 'vacant'
        items.append({'status': status})
        
    mock_current_table.scan.return_value = {'Items': items}
    
    event = {
        'Records': [
            {
                'eventName': 'MODIFY',
                'dynamodb': {
                    'NewImage': {
                        'space_id': {'S': 'A-01'},
                        'status': {'S': 'occupied'},
                        'timestamp': {'S': datetime.now(timezone.utc).isoformat()}
                    }
                }
            }
        ]
    }
    
    lambda_function.lambda_handler(event, None)
    
    call_args_list = lambda_function.sqs.send_message.call_args_list
    found_alert = False
    for call in call_args_list:
        msg_body = json.loads(call.kwargs['MessageBody'])
        if msg_body.get('type') == 'HIGH_OCCUPANCY':
            found_alert = True
            print(f"\n Found Alert: {msg_body['occupancy_percent']}% Occupied")
            assert msg_body['occupancy_percent'] == 90.0
            break
            
    assert found_alert, "Did not find HIGH_OCCUPANCY alert"
    print("\n Success! Occupancy calculated correctly from DB.")

if __name__ == "__main__":
    try:
        test_health_check_inactive_sensor()
        test_occupancy_calculation()
        print("\n All health check tests passed!")
    except AssertionError as e:
        print(f"\n Test Failed: {e}")
    except Exception as e:
        print(f"\n Error: {e}")
