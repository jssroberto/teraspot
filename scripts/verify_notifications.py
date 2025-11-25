import boto3
import json
import time

def verify_notifications():
    print("Scanning AWS Resources for Notifications...")
    
    sqs = boto3.client('sqs', region_name='us-east-1')
    sns = boto3.client('sns', region_name='us-east-1')
    
    
    print("\n--- SQS Queues ---")
    queues = sqs.list_queues(QueueNamePrefix='teraspot')
    queue_urls = queues.get('QueueUrls', [])
    
    alerts_queue_url = None
    for url in queue_urls:
        print(f"Found Queue: {url}")
        if 'alert' in url.lower():
            alerts_queue_url = url
            
    if not alerts_queue_url and queue_urls:
        alerts_queue_url = queue_urls[0]
        
    
    print("\n--- SNS Topics ---")
    topics = sns.list_topics()
    topic_arns = [t['TopicArn'] for t in topics.get('Topics', [])]
    
    alerts_topic_arn = None
    for arn in topic_arns:
        print(f"Found Topic: {arn}")
        if 'alert' in arn.lower() or 'notification' in arn.lower():
            alerts_topic_arn = arn

    
    if alerts_queue_url:
        print(f"\nSending TEST message to SQS: {alerts_queue_url}")
        try:
            sqs.send_message(
                QueueUrl=alerts_queue_url,
                MessageBody=json.dumps({
                    "type": "TEST_VERIFICATION",
                    "message": "This is a test message to verify SQS flow.",
                    "timestamp": time.time()
                })
            )
            print("Message sent to SQS! Check the queue in AWS Console.")
        except Exception as e:
            print(f"Failed to send to SQS: {e}")
    else:
        print("No suitable SQS Queue found to test.")

    
    if alerts_topic_arn:
        print(f"\nSending TEST email/SMS to SNS: {alerts_topic_arn}")
        try:
            sns.publish(
                TopicArn=alerts_topic_arn,
                Subject="TeraSpot Test Alert",
                Message="If you are reading this, your SNS notifications are working! 🚀"
            )
            print("Notification sent to SNS! Check your email/SMS.")
        except Exception as e:
            print(f"Failed to publish to SNS: {e}")
    else:
        print("No suitable SNS Topic found to test.")

    print("\n---------------------------------------------------")
    print("SUMMARY:")
    if alerts_queue_url:
        print(f"1. Go to SQS Console -> Queue: {alerts_queue_url.split('/')[-1]}")
        print("   -> Click 'Send and receive messages' -> 'Poll for messages'")
        print("   -> You should see the test message.")
    
    if alerts_topic_arn:
        print(f"2. Check your email/SMS subscribed to: {alerts_topic_arn.split(':')[-1]}")
    
    if not alerts_topic_arn and not alerts_queue_url:
        print("Could not find SQS or SNS resources. Are you logged in to the right account?")

if __name__ == "__main__":
    verify_notifications()
