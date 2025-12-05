#!/usr/bin/env python3
"""
Camera Manager Script
Manage simulated camera containers on the EC2 Camera Hub via AWS SSM.
"""

import argparse
import time
import boto3
import sys

def get_instance_id(ec2_client, tag_value="TeraSpot-Camera-Hub"):
    """Find the running Camera Hub instance."""
    response = ec2_client.describe_instances(
        Filters=[
            {"Name": "tag:Name", "Values": [tag_value]},
            {"Name": "instance-state-name", "Values": ["running"]}
        ]
    )
    reservations = response.get("Reservations", [])
    if not reservations:
        return None
    
    # Return the first one found
    return reservations[0]["Instances"][0]["InstanceId"]

def run_ssm_command(ssm_client, instance_id, command):
    """Run a shell command on the instance via SSM."""
    print(f"Sending command to {instance_id}: {command}")
    response = ssm_client.send_command(
        InstanceIds=[instance_id],
        DocumentName="AWS-RunShellScript",
        Parameters={"commands": [command]}
    )
    command_id = response["Command"]["CommandId"]
    
    # Wait for result
    time.sleep(1)
    print(f"Command sent (ID: {command_id}). Waiting for output...")
    
    try:
        waiter = ssm_client.get_waiter("command_executed")
        waiter.wait(
            CommandId=command_id,
            InstanceId=instance_id,
            WaiterConfig={"Delay": 1, "MaxAttempts": 15}
        )
        
        output = ssm_client.get_command_invocation(
            CommandId=command_id,
            InstanceId=instance_id
        )
        print("\n--- Output ---")
        print(output.get("StandardOutputContent", ""))
        if output.get("StandardErrorContent"):
            print("--- Error ---")
            print(output.get("StandardErrorContent"))
            
    except Exception as e:
        print(f"Error waiting for command: {e}")

def list_cameras(ssm_client, instance_id):
    """List running docker containers (cameras)."""
    cmd = "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'"
    run_ssm_command(ssm_client, instance_id, cmd)

def kill_camera(ssm_client, instance_id, camera_id):
    """Stop a specific camera container."""
    cmd = f"docker stop {camera_id}"
    run_ssm_command(ssm_client, instance_id, cmd)

def start_camera(ssm_client, instance_id, camera_id):
    """Start a specific camera container."""
    cmd = f"docker start {camera_id}"
    run_ssm_command(ssm_client, instance_id, cmd)

def kill_site(ec2_client, instance_id):
    """Stop the entire EC2 instance."""
    print(f"Stopping instance {instance_id}...")
    ec2_client.stop_instances(InstanceIds=[instance_id])
    print("Instance stop requested.")

def main():
    parser = argparse.ArgumentParser(description="TeraSpot Camera Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("list", help="List running cameras")
    
    kill_parser = subparsers.add_parser("kill", help="Stop a camera")
    kill_parser.add_argument("camera_id", help="Container ID or Name (e.g., camera-sim-1)")

    start_parser = subparsers.add_parser("start", help="Start a camera")
    start_parser.add_argument("camera_id", help="Container ID or Name (e.g., camera-sim-1)")

    subparsers.add_parser("kill-site", help="Stop the entire EC2 instance")

    args = parser.parse_args()

    session = boto3.Session()
    ec2 = session.client("ec2")
    ssm = session.client("ssm")

    instance_id = get_instance_id(ec2)
    if not instance_id:
        print("Error: No running 'TeraSpot-Camera-Hub' instance found.")
        sys.exit(1)

    if args.command == "list":
        list_cameras(ssm, instance_id)
    elif args.command == "kill":
        kill_camera(ssm, instance_id, args.camera_id)
    elif args.command == "start":
        start_camera(ssm, instance_id, args.camera_id)
    elif args.command == "kill-site":
        kill_site(ec2, instance_id)

if __name__ == "__main__":
    main()
