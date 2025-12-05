import boto3
import os

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
TABLE_NAME = os.getenv('DYNAMODB_TABLE', 'parking-spaces-dev')
table = dynamodb.Table(TABLE_NAME)

def delete_ghost_records():
    print(f"Scanning table {TABLE_NAME} for ghost records...")
    response = table.scan()
    items = response.get('Items', [])
    
    while 'LastEvaluatedKey' in response:
        response = table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        items.extend(response.get('Items', []))
    
    ghost_device = 'TeraSpot-Processor'
    deleted_count = 0
    
    for item in items:
        device_id = item.get('device_id')
        space_id = item.get('space_id')
        
        if device_id == ghost_device:
            print(f"Deleting ghost record: Space={space_id}, Device={device_id}")
            table.delete_item(
                Key={
                    'space_id': space_id
                }
            )
            deleted_count += 1
            
    print(f"Deleted {deleted_count} ghost records.")

if __name__ == "__main__":
    delete_ghost_records()
