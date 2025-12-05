import boto3
import sys

def scan_all():
    dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
    table = dynamodb.Table('parking-spaces-dev')
    
    print(f"Scanning table parking-spaces-dev...")
    response = table.scan()
    items = response.get('Items', [])
    print(f"Total items in table: {len(items)}")
    
    for item in items:
        dev_id = item.get('device_id')
        space_id = item.get('space_id')
        is_alive = item.get('is_alive')
        print(f"Item: Space={space_id}, Device={dev_id}, Alive={is_alive}")

if __name__ == "__main__":
    scan_all()
