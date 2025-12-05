import boto3
import os

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
TABLE_NAME = os.getenv('DYNAMODB_TABLE', 'parking-spaces-dev')
table = dynamodb.Table(TABLE_NAME)

def list_unique_devices():
    print(f"Scanning table {TABLE_NAME} for unique devices...")
    response = table.scan()
    items = response.get('Items', [])
    
    devices = set()
    device_status = {}

    for item in items:
        device_id = item.get('device_id')
        is_alive = item.get('is_alive', True) # Default to True if missing
        if device_id:
            devices.add(device_id)
            # Track if we've seen this device as active at least once, or if it's all dead
            if device_id not in device_status:
                device_status[device_id] = is_alive
            else:
                # If we find an entry where it is alive, mark it as alive (though usually all records for a device share status)
                if is_alive:
                    device_status[device_id] = True
    
    print("\nFound Devices:")
    for device in devices:
        status = "Alive" if device_status.get(device) else "Offline"
        print(f"- {device} ({status})")

if __name__ == "__main__":
    list_unique_devices()
