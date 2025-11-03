import json
import logging
import os
import boto3
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Configuración
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
SNS_TOPIC_ARN = os.getenv('SNS_TOPIC_ARN', '')
SES_SENDER_EMAIL = os.getenv('SES_SENDER_EMAIL', 'noreply@teraspot.com')
ADMIN_EMAIL = os.getenv('ADMIN_EMAIL', 'admin@teraspot.com')

sns_client = boto3.client('sns', region_name=AWS_REGION)
ses_client = boto3.client('ses', region_name=AWS_REGION)


def format_alert_html(alerts: List[Dict[str, Any]]) -> str:
    """
    Formatea alertas en HTML para enviar por email.
    """
    alert_rows = ""
    for alert in alerts:
        severity_color = {
            'WARNING': '#FFA500',      # Naranja
            'ALERT': '#FF6B6B',        # Rojo
            'CRITICAL': '#DC143C'      # Rojo oscuro
        }.get(alert.get('severity', 'WARNING'), '#999999')
        
        alert_rows += f"""
        <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px; color: {severity_color}; font-weight: bold;">
                {alert.get('severity', 'N/A')}
            </td>
            <td style="padding: 10px;">{alert.get('type', 'N/A')}</td>
            <td style="padding: 10px;">{alert.get('message', 'N/A')}</td>
        </tr>
        """
    
    html_body = f"""
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; }}
            table {{ width: 100%; border-collapse: collapse; }}
            th {{ background-color: #333; color: white; padding: 10px; text-align: left; }}
            .summary {{ background-color: #f9f9f9; padding: 15px; margin-bottom: 20px; border-radius: 5px; }}
        </style>
    </head>
    <body>
        <h1>🚨 TeraSpot Parking Alert</h1>
        <div class="summary">
            <p><strong>Timestamp:</strong> {datetime.utcnow().isoformat()}Z</p>
            <p><strong>Total Alerts:</strong> {len(alerts)}</p>
        </div>
        <table>
            <thead>
                <tr>
                    <th>Severity</th>
                    <th>Type</th>
                    <th>Message</th>
                </tr>
            </thead>
            <tbody>
                {alert_rows}
            </tbody>
        </table>
    </body>
    </html>
    """
    return html_body


def publish_to_sns(alerts: List[Dict[str, Any]]) -> bool:
    """
    Publica alertas a SNS (para que otros servicios se suscriban).
    """
    if not SNS_TOPIC_ARN:
        logger.warning("⚠️ SNS_TOPIC_ARN not configured")
        return False
    
    try:
        alert_summary = "\n".join([
            f"[{a.get('severity')}] {a.get('message')}"
            for a in alerts
        ])
        
        sns_client.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=f"🚨 TeraSpot Alert: {len(alerts)} issues",
            Message=alert_summary
        )
        logger.info(f"✅ Published {len(alerts)} alerts to SNS")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to publish to SNS: {str(e)}")
        return False


def send_email_alert(alerts: List[Dict[str, Any]]) -> bool:
    """
    Envía email con alertas (requiere SES configurado).
    """
    if not SES_SENDER_EMAIL or not ADMIN_EMAIL:
        logger.warning("⚠️ SES emails not configured")
        return False
    
    try:
        html_body = format_alert_html(alerts)
        
        ses_client.send_email(
            Source=SES_SENDER_EMAIL,
            Destination={'ToAddresses': [ADMIN_EMAIL]},
            Message={
                'Subject': {
                    'Data': f"🚨 TeraSpot Alert: {len(alerts)} issues detected",
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Html': {
                        'Data': html_body,
                        'Charset': 'UTF-8'
                    }
                }
            }
        )
        logger.info(f"✅ Email sent to {ADMIN_EMAIL} with {len(alerts)} alerts")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to send email: {str(e)}")
        return False


def extract_alerts_from_dynamodb_stream(records: List[Dict]) -> List[Dict[str, Any]]:
    """
    Extrae alertas de eventos DynamoDB Streams.
    """
    alerts = []
    for record in records:
        try:
            new_image = record.get('dynamodb', {}).get('NewImage', {})
            if new_image:
                alert = {
                    'space_id': new_image.get('space_id', {}).get('S', 'N/A'),
                    'type': new_image.get('alert_type', {}).get('S', 'UNKNOWN'),
                    'severity': new_image.get('severity', {}).get('S', 'WARNING'),
                    'message': new_image.get('message', {}).get('S', 'N/A'),
                    'timestamp': new_image.get('timestamp', {}).get('S', '')
                }
                alerts.append(alert)
        except Exception as e:
            logger.warning(f"⚠️ Failed to parse record: {str(e)}")
    
    return alerts


def lambda_handler(event, context):
    """
    Procesa alertas de múltiples fuentes:
    - DynamoDB Streams (cuando ingest_status escribe alertas)
    - Directamente desde ingest_status
    - CloudWatch Events (periódico)
    """
    try:
        logger.info("📨 analytics_notifier triggered")
        
        alerts = []
        
        # Source 1: DynamoDB Streams
        if 'Records' in event and event['Records']:
            first_record = event['Records'][0]
            if 'dynamodb' in first_record:
                logger.info("📊 Processing DynamoDB Stream event")
                alerts = extract_alerts_from_dynamodb_stream(event['Records'])
        
        # Source 2: Payload directo
        if 'alerts' in event and not alerts:
            logger.info("📋 Processing direct alerts payload")
            alerts = event.get('alerts', [])
        
        # Si no hay alertas, retornar
        if not alerts:
            logger.info("ℹ️ No alerts to process")
            return {
                'statusCode': 200,
                'body': json.dumps({'message': 'No alerts', 'alerts_processed': 0})
            }
        
        # Enviar notificaciones
        sns_sent = publish_to_sns(alerts)
        email_sent = send_email_alert(alerts)
        
        logger.info(f"✅ Processed {len(alerts)} alerts. SNS: {sns_sent}, Email: {email_sent}")
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Alerts processed',
                'alerts_processed': len(alerts),
                'sns_sent': sns_sent,
                'email_sent': email_sent
            })
        }
    
    except Exception as e:
        logger.error(f"❌ Error in analytics_notifier: {str(e)}", exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
