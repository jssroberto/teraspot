#!/usr/bin/env python3
"""
Script to test device commands (screenshot, reload_config) via the API Gateway.
Usage:
    python scripts/test_device_commands.py --api-id <API_ID> --device-id <DEVICE_ID> --command screenshot
"""

import argparse
import json
import sys
import time
import requests

def main():
    parser = argparse.ArgumentParser(description="Test TeraSpot Device Commands")
    parser.add_argument("--api-id", required=True, help="API Gateway ID")
    parser.add_argument("--region", default="us-east-1", help="AWS Region")
    parser.add_argument("--stage", default="dev", help="API Stage")
    parser.add_argument("--device-id", default="teraspot-edge-device", help="Device ID")
    parser.add_argument("--command", choices=["screenshot", "reload_config"], required=True, help="Command to send")
    
    args = parser.parse_args()

    url = f"https://{args.api_id}.execute-api.{args.region}.amazonaws.com/{args.stage}/device/{args.device_id}/command"
    
    print(f"Sending '{args.command}' command to {url}...")
    
    payload = {
        "command": args.command,
        "device_id": args.device_id
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("\nSuccess!")
            print(json.dumps(data, indent=2))
            
            if args.command == "screenshot":
                print("\n[INFO] Check your S3 bucket for the screenshot.")
                if "upload_url" in data:
                    print(f"Upload URL generated (valid for 5 mins): {data['upload_url'][:50]}...")
        else:
            print("\nError:")
            print(response.text)
            
    except Exception as e:
        print(f"\nFailed to send request: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
