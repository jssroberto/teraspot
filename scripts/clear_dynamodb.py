#!/usr/bin/env python3
"""
Clear DynamoDB tables and set up proper space naming convention
Camera 1 (camera-sim-1) -> A-01 to A-10
Camera 2 (camera-sim-2) -> B-01 to B-10  
Camera 3 (camera-sim-3) -> C-01 to C-10
"""
import boto3
from decimal import Decimal

REGION = 'us-east-1'
CURRENT_TABLE = 'parking-spaces-dev'
HISTORY_TABLE = 'parking-history'

dynamodb = boto3.resource('dynamodb', region_name=REGION)
current_table = dynamodb.Table(CURRENT_TABLE)
history_table = dynamodb.Table(HISTORY_TABLE)

def clear_table(table, table_name, key_schema='simple'):
    """Delete all items from a DynamoDB table"""
    print(f"\nClearing {table_name}...")
    
    # Scan and delete all items
    response = table.scan()
    items = response.get('Items', [])
    
    deleted_count = 0
    for item in items:
        try:
            if key_schema == 'composite':
                # History table uses space_id + timestamp
                table.delete_item(Key={
                    'space_id': item['space_id'],
                    'timestamp': item['timestamp']
                })
            else:
                # Current table uses just space_id
                table.delete_item(Key={'space_id': item['space_id']})
            deleted_count += 1
        except Exception as e:
            print(f"  Error deleting {item.get('space_id')}: {e}")
    
    # Handle pagination
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items = response.get('Items', [])
        for item in items:
            try:
                if key_schema == 'composite':
                    table.delete_item(Key={
                        'space_id': item['space_id'],
                        'timestamp': item['timestamp']
                    })
                else:
                    table.delete_item(Key={'space_id': item['space_id']})
                deleted_count += 1
            except Exception as e:
                print(f"  Error deleting {item.get('space_id')}: {e}")
    
    print(f"✓ Deleted {deleted_count} items from {table_name}")
    return deleted_count

def main():
    print("=" * 60)
    print("CLEARING DYNAMODB TABLES")
    print("=" * 60)
    
    # Clear both tables
    current_deleted = clear_table(current_table, CURRENT_TABLE, 'simple')
    history_deleted = clear_table(history_table, HISTORY_TABLE, 'composite')
    
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Current table ({CURRENT_TABLE}): {current_deleted} items deleted")
    print(f"History table ({HISTORY_TABLE}): {history_deleted} items deleted")
    print("\n✓ All data cleared!")
    print("\nNaming convention for ROI configuration:")
    print("  camera-sim-1 → A-01, A-02, A-03, ..., A-10")
    print("  camera-sim-2 → B-01, B-02, B-03, ..., B-10")
    print("  camera-sim-3 → C-01, C-02, C-03, ..., C-10")
    print("\nNext steps:")
    print("1. Go to the Cameras tab in the frontend")
    print("2. For each camera, draw 10 parking space polygons")
    print("3. Name them according to the convention above")
    print("4. Save the ROI configuration")

if __name__ == '__main__':
    main()
