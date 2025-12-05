#!/usr/bin/env python3
"""
Register camera simulators as devices in the TeraSpot system
"""
import boto3
import json

# Configuration
BUCKET_NAME = 'teraspot-config-dev'
REGION = 'us-east-1'

s3 = boto3.client('s3', region_name=REGION)

# Camera configurations
cameras = [
    {
        'device_id': 'camera-sim-1',
        'name': 'Camera Simulator 1',
        'ip': '54.234.122.159',
        'port': 8883,  # MQTT port
        'video_source': '/app/assets/parking_lot.mp4',
        'facility_id': 'facility-1',
        'zone_id': 'zone-1',
        'status': 'active'
    },
    {
        'device_id': 'camera-sim-2',
        'name': 'Camera Simulator 2',
        'ip': '54.234.122.159',
        'port': 8883,
        'video_source': '/app/assets/parking_lot.mp4',
        'facility_id': 'facility-1',
        'zone_id': 'zone-1',
        'status': 'active'
    },
    {
        'device_id': 'camera-sim-3',
        'name': 'Camera Simulator 3',
        'ip': '54.234.122.159',
        'port': 8883,
        'video_source': '/app/assets/parking_lot.mp4',
        'facility_id': 'facility-1',
        'zone_id': 'zone-1',
        'status': 'active'
    }
]

def register_camera(camera_config):
    """Register a camera device in S3"""
    device_id = camera_config['device_id']
    config_key = f'configs/device-{device_id}.json'
    
    config_data = {
        'config_type': 'device',
        'device_id': device_id,
        'value': camera_config
    }
    
    try:
        s3.put_object(
            Bucket=BUCKET_NAME,
            Key=config_key,
            Body=json.dumps(config_data, indent=2),
            ContentType='application/json'
        )
        print(f"✓ Registered {device_id}")
        return True
    except Exception as e:
        print(f"✗ Failed to register {device_id}: {e}")
        return False

def main():
    print(f"Registering cameras to S3 bucket: {BUCKET_NAME}\n")
    
    success_count = 0
    for camera in cameras:
        if register_camera(camera):
            success_count += 1
    
    print(f"\n{success_count}/{len(cameras)} cameras registered successfully")
    print("\nNext steps:")
    print("1. Configure ROI polygons for each camera in the frontend")
    print("2. Test screenshot functionality via the Cameras tab")
    print("3. Verify data is flowing to the dashboard")

if __name__ == '__main__':
    main()
