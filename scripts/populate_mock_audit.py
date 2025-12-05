
import boto3
import random
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import math

# CONFIG
REGION = 'us-east-1'
TABLE_NAME = 'parking-history' 
DAYS_BACK = 30
SPACES_COUNT = 20 # Keep it small for quick population

# INITIALIZE
dynamodb = boto3.resource('dynamodb', region_name=REGION)
table = dynamodb.Table(TABLE_NAME)

def generate_mock_data():
    print(f"Adding mock data to {TABLE_NAME} for last {DAYS_BACK} days...")
    
    current_time = datetime.now(timezone.utc)
    # Align to top of hour
    current_time = current_time.replace(minute=0, second=0, microsecond=0)
    
    total_records = 0
    
    with table.batch_writer() as batch:
        for day in range(DAYS_BACK):
            date_base = current_time - timedelta(days=day)
            
            # Simulate hourly data
            for hour in range(24):
                # Reverse order (newest first) not strictly needed for batch, but logic flows better forward
                timestamp_dt = date_base.replace(hour=hour)
                timestamp_str = timestamp_dt.isoformat()
                
                # Business Logic: 
                # 0-6: Low
                # 7-9: Rising
                # 9-17: High (Peak 12-14)
                # 17-20: Falling
                # 20-23: Low
                
                # Simple Gaussian-ish model
                # Peak at 14 (2pm), sigma=4
                hour_val = hour
                peak_prob = 0.9
                center = 14
                sigma = 3.5
                
                occupancy_prob = peak_prob * math.exp(-((hour_val - center)**2) / (2 * sigma**2))
                occupancy_prob = max(0.05, min(0.95, occupancy_prob + random.uniform(-0.1, 0.1)))
                
                # Weekend reduction
                if timestamp_dt.weekday() >= 5: # Sat/Sun
                    occupancy_prob *= 0.3
                
                for i in range(SPACES_COUNT):
                    space_id = f"space_{i:02d}"
                    is_occupied = random.random() < occupancy_prob
                    
                    status = 'occupied' if is_occupied else 'vacant'
                    
                    # DynamoDB Item
                    item = {
                        'space_id': space_id,
                        'timestamp': timestamp_str,
                        'status': status,
                        'device_id': 'mock-device-01',
                        'confidence': Decimal('0.99')
                    }
                    
                    batch.put_item(Item=item)
                    total_records += 1
                    
            print(f" Day {day+1}/{DAYS_BACK} processed ({total_records} records so far)...")
            
    print(f"Done! Written {total_records} records.")

if __name__ == "__main__":
    generate_mock_data()
