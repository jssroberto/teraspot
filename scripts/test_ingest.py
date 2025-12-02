import boto3
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_ingest():
    client = boto3.client("lambda", region_name="us-east-1")
    
    payload = [
        {
            "event_id": "test-event-1",
            "space_id": "space-1",
            "status": "occupied",
            "confidence": 0.95,
            "timestamp": "2025-11-29T12:00:00Z",
            "device_id": "manual-test",
            "facility_id": "test-facility",
            "zone_id": "test-zone",
            "data_source": "manual"
        }
    ]
    
    try:
        logger.info("Invoking teraspot-ingest-status...")
        response = client.invoke(
            FunctionName="teraspot-ingest-status",
            InvocationType="RequestResponse",
            Payload=json.dumps(payload)
        )
        
        payload_stream = response["Payload"]
        response_data = json.loads(payload_stream.read().decode("utf-8"))
        
        logger.info(f"Status Code: {response['StatusCode']}")
        logger.info(f"Response: {json.dumps(response_data, indent=2)}")
        
        if "FunctionError" in response:
            logger.error(f"Function Error: {response['FunctionError']}")
            
    except Exception as e:
        logger.error(f"Invocation failed: {e}")

if __name__ == "__main__":
    test_ingest()
