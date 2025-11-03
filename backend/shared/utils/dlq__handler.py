import boto3
import json
import logging
import os

logger = logging.getLogger()
logger.setLevel(logging.INFO)
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
QUEUE_URL = os.getenv('SQS_URL', 'us-east-1')

def sendMessageDLQ(message_payload):
  try:
    sqs = boto3.client('sqs', region_name=AWS_REGION) 

    response = sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps(message_payload)
    )
    logger.info(f"✅ Éxito")
    logger.info(f"Mensaje ID: {response.get('MessageId')}")

  except Exception as e:
    logger.error(f"❌ ERROR: No se pudo enviar el mensaje.")
    logger.error(e)