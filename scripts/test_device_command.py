import requests
import json

def test_screenshot():
    url = "https://7omj4x5pbg.execute-api.us-east-1.amazonaws.com/dev/device/TeraSpot-edge-device/command"
    payload = {
        "device_id": "TeraSpot-edge-device",
        "command": "screenshot"
    }
    
    print(f"Triggering screenshot for TeraSpot-edge-device...")
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        print("Response:", response.text)
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_screenshot()
