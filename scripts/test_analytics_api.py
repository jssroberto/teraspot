import requests
import json

API_URL = "https://vmdq0zxc18.execute-api.us-east-1.amazonaws.com/dev/kpi"

# Test 1: Occupancy Trend
print("Testing Occupancy Trend...")
response = requests.post(API_URL, json={
    "kpi": "occupancy_trend",
    "params": {
        "hours_back": 24,
        "interval_minutes": 60
    }
})
print(f"Status: {response.status_code}")
data = response.json()
print(f"Data points: {data.get('data_points', 0)}")
if data.get('trend_data'):
    print(f"Sample: {data['trend_data'][0]}")
print()

# Test 2: Peak Hours
print("Testing Peak Hours...")
response = requests.post(API_URL, json={
    "kpi": "peak_hours",
    "params": {
        "days_back": 30
    }
})
print(f"Status: {response.status_code}")
data = response.json()
if data.get('peak_hours'):
    print(f"Peak hours: {data['peak_hours'][:3]}")
print()

# Test 3: Prediction
print("Testing Prediction...")
response = requests.post(API_URL, json={
    "kpi": "prediction",
    "params": {
        "hours_back": 168,
        "prediction_horizon_hours": 24
    }
})
print(f"Status: {response.status_code}")
data = response.json()
print(f"Trend: {data.get('trend_direction', 'N/A')}")
print(f"Slope: {data.get('slope', 'N/A')}")
