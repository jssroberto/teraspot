import logging
import os
import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ.get("CONNECTIONS_TABLE")

def lambda_handler(event, context):
    connection_id = event["requestContext"]["connectionId"]
    logger.info(f"Connect: {connection_id}")

    table = dynamodb.Table(TABLE_NAME)
    table.put_item(Item={"connection_id": connection_id})

    return {"statusCode": 200, "body": "Connected"}
