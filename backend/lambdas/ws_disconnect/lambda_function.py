import json
import logging
import os
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("CONNECTIONS_TABLE")

def lambda_handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    logger.info(f"Disconnect: {connection_id}")

    table = dynamodb.Table(TABLE_NAME)
    try:
        table.delete_item(Key={"connection_id": connection_id})
    except Exception as e:
        logger.error(f"Failed to delete connection {connection_id}: {e}")

    return {"statusCode": 200, "body": "Disconnected"}
