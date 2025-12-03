import boto3
import time
from decimal import Decimal
from datetime import datetime, timedelta

# Configuration
REGION = 'us-east-1'
SPACES_TABLE = 'parking-spaces-dev'
HISTORY_TABLE = 'parking-history'

# Initialize DynamoDB resource
dynamodb = boto3.resource('dynamodb', region_name=REGION)

def clear_table(table_name):
    """
    Deletes all items from the specified DynamoDB table.
    """
    table = dynamodb.Table(table_name)
    print(f"Scanning table {table_name} to delete items...")
    
    try:
        scan = table.scan()
        items = scan.get('Items', [])
        
        while 'LastEvaluatedKey' in scan:
            scan = table.scan(ExclusiveStartKey=scan['LastEvaluatedKey'])
            items.extend(scan.get('Items', []))
            
        if not items:
            print(f"Table {table_name} is already empty.")
            return

        print(f"Deleting {len(items)} items from {table_name}...")
        
        with table.batch_writer() as batch:
            for item in items:
                # We need the primary key(s) to delete
                # For parking-spaces-dev, PK is space_id
                # For parking-history, PK is space_id, SK is timestamp
                
                key = {'space_id': item['space_id']}
                if 'timestamp' in item and table_name == HISTORY_TABLE:
                     key['timestamp'] = item['timestamp']
                
                batch.delete_item(Key=key)
                
        print(f"Successfully cleared {table_name}.")
        
    except Exception as e:
        print(f"Error clearing table {table_name}: {e}")

def inject_spaces_data():
    """
    Injects normalized sample data into the parking-spaces-dev table.
    """
    table = dynamodb.Table(SPACES_TABLE)
    print(f"Injecting sample data into {SPACES_TABLE}...")
    
    # Normalized Data
    items = [
        {
            'space_id': 'A-01',
            'status': 'occupied',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'confidence': Decimal('0.98'),
            'device_id': 'cam-01',
            'type': 'standard'
        },
        {
            'space_id': 'A-02',
            'status': 'vacant',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'confidence': Decimal('0.99'),
            'device_id': 'cam-01',
            'type': 'standard'
        },
        {
            'space_id': 'A-03',
            'status': 'occupied',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'confidence': Decimal('0.85'),
            'device_id': 'cam-01',
            'type': 'disabled'
        },
        {
            'space_id': 'B-01',
            'status': 'vacant',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'confidence': Decimal('0.95'),
            'device_id': 'cam-02',
            'type': 'ev'
        },
         {
            'space_id': 'B-02',
            'status': 'unknown',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'confidence': Decimal('0.00'),
            'device_id': 'cam-02',
            'type': 'standard'
        }
    ]
    
    try:
        with table.batch_writer() as batch:
            for item in items:
                batch.put_item(Item=item)
        print(f"Successfully injected {len(items)} items into {SPACES_TABLE}.")
    except Exception as e:
        print(f"Error injecting data into {SPACES_TABLE}: {e}")

def inject_history_data():
    """
    Injects historical sample data into the parking-history table.
    """
    table = dynamodb.Table(HISTORY_TABLE)
    print(f"Injecting sample data into {HISTORY_TABLE}...")
    
    items = []
    base_time = datetime.utcnow()
    
    # Generate some history for A-01
    for i in range(5):
        t = base_time - timedelta(hours=i+1)
        items.append({
            'space_id': 'A-01',
            'timestamp': t.isoformat() + 'Z',
            'status': 'occupied' if i % 2 == 0 else 'vacant',
            'confidence': Decimal('0.95'),
            'device_id': 'cam-01'
        })
        
    # Generate some history for A-02
    for i in range(5):
        t = base_time - timedelta(hours=i+1)
        items.append({
            'space_id': 'A-02',
            'timestamp': t.isoformat() + 'Z',
            'status': 'vacant',
            'confidence': Decimal('0.98'),
            'device_id': 'cam-01'
        })

    try:
        with table.batch_writer() as batch:
            for item in items:
                batch.put_item(Item=item)
        print(f"Successfully injected {len(items)} items into {HISTORY_TABLE}.")
    except Exception as e:
        print(f"Error injecting data into {HISTORY_TABLE}: {e}")

if __name__ == "__main__":
    print("Starting DynamoDB Normalization...")
    
    # Clear Tables
    clear_table(SPACES_TABLE)
    clear_table(HISTORY_TABLE)
    
    # Inject Data
    inject_spaces_data()
    inject_history_data()
    
    print("Normalization Complete.")
