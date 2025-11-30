import requests
import json

def check_status():
    url = "https://7omj4x5pbg.execute-api.us-east-1.amazonaws.com/dev/status"
    
    print(f"Checking Parking Status...")
    try:
        response = requests.get(url)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print("Response:", json.dumps(data, indent=2))
            
            spaces = data.get("spaces", [])
            if spaces:
                print(f"\nSUCCESS: Found {len(spaces)} spaces with status!")
                for s in spaces:
                    print(f" - {s.get('space_id')}: {s.get('status')}")
            else:
                print("\nWARNING: API returned 200 but 'spaces' list is empty.")
        else:
            print("Error response:", response.text)
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    check_status()
