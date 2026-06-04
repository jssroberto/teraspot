import requests
import json

def check_roi():
    import os
    api_base = os.getenv("TERASPOT_API_URL", "https://7omj4x5pbg.execute-api.us-east-1.amazonaws.com/dev").rstrip("/")
    url = f"{api_base}/config"
    device_id = "TeraSpot-edge-device"
    payload = {
        "action": "GET",
        "config_id": f"roi-{device_id}"
    }
    
    print(f"Checking ROI for {device_id}...")
    try:
        response = requests.post(url, json=payload)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("Response:", json.dumps(data, indent=2))
            
            spaces = data.get("config", {}).get("value", {}).get("spaces")
            if spaces:
                print(f"\nSUCCESS: Found {len(spaces)} spaces in configuration!")
            else:
                print("\nWARNING: Config found but 'spaces' list is empty or missing.")
        else:
            print("Error response:", response.text)
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    check_roi()
