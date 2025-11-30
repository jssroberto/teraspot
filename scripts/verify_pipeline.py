import boto3
import json
import time
import os
from datetime import datetime, timezone

# Configuration
REGION = 'us-east-1'
TABLE_NAME = 'parking-spaces-dev'
ALERTS_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/755453699050/teraspot-alerts-dev'
LOW_CONF_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/755453699050/teraspot-low-confidence-dev'

dynamodb = boto3.client('dynamodb', region_name=REGION)
sqs = boto3.client('sqs', region_name=REGION)

def clear_queue(queue_url):
    """Purges the queue to ensure a clean test"""
    try:
        sqs.purge_queue(QueueUrl=queue_url)
        print(f"🧹 Purged queue: {queue_url.split('/')[-1]}")
        time.sleep(1) # Allow purge to propagate
    except Exception as e:
        print(f"⚠️ Could not purge queue: {e}")

def simulate_low_confidence():
    """Writes a low confidence record to DynamoDB"""
    print("\n🧪 TEST 1: Simulating LOW CONFIDENCE Event...")
    item = {
        'space_id': {'S': 'test-space-01'},
        'device_id': {'S': 'test-device'},
        'status': {'S': 'occupied'},
        'confidence': {'N': '0.45'}, # Below 0.8 threshold
        'timestamp': {'S': datetime.now(timezone.utc).isoformat()}
    }
    
    dynamodb.put_item(TableName=TABLE_NAME, Item=item)
    print("✅ Wrote item to DynamoDB")

def simulate_high_occupancy():
    """Writes multiple occupied records to trigger high occupancy"""
    print("\n🧪 TEST 2: Simulating HIGH OCCUPANCY Event...")
    # We need to fill up the table to > 80%
    # This might be tricky if the table is huge, but for dev it's likely small.
    # We'll write 5 items as 'occupied' and hope the total count is small enough.
    
    for i in range(5):
        item = {
            'space_id': {'S': f'test-space-high-{i}'},
            'device_id': {'S': 'test-device'},
            'status': {'S': 'occupied'},
            'confidence': {'N': '0.99'},
            'timestamp': {'S': datetime.now(timezone.utc).isoformat()}
        }
        dynamodb.put_item(TableName=TABLE_NAME, Item=item)
    print("✅ Wrote 5 occupied items to DynamoDB")

def check_queue(queue_url, expected_type):
    """Polls SQS for the expected alert"""
    print(f"👀 Polling {queue_url.split('/')[-1]} for messages...")
    
    for _ in range(10): # Poll for 10 seconds
        response = sqs.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=1,
            WaitTimeSeconds=1,
            AttributeNames=['All']
        )
        
        if 'Messages' in response:
            for msg in response['Messages']:
                body = json.loads(msg['Body'])
                alert_type = body.get('type')
                print(f"📨 Received Message: {alert_type}")
                
                if alert_type == expected_type:
                    print(f"🎉 SUCCESS: Found expected alert '{expected_type}'")
                    # Cleanup
                    sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=msg['ReceiptHandle'])
                    return True
        time.sleep(1)
        
    print(f"❌ FAILED: Did not receive '{expected_type}' alert in time.")
    return False

if __name__ == "__main__":
    print("🚀 Starting End-to-End Verification")
    
    # 1. Clear Queues
    clear_queue(ALERTS_QUEUE_URL)
    clear_queue(LOW_CONF_QUEUE_URL)
    
    # 2. Test Low Confidence
    simulate_low_confidence()
    check_queue(LOW_CONF_QUEUE_URL, 'LOW_CONFIDENCE')
    
    # 3. Test High Occupancy (Optional, might depend on total table size)
    # simulate_high_occupancy()
    # check_queue(ALERTS_QUEUE_URL, 'HIGH_OCCUPANCY')
    
    print("\n✨ Verification Complete")
