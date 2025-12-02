# PowerShell Script to Import Existing Resources into Terraform

# Navigate to the Terraform directory relative to this script
$ScriptDir = Split-Path $MyInvocation.MyCommand.Path
Set-Location "$ScriptDir/../infrastructure/terraform"

# 1. Import SQS Queues
echo "Importing SQS Queues..."
terraform import aws_sqs_queue.alerts_queue https://sqs.us-east-1.amazonaws.com/755453699050/teraspot-alerts-dev
terraform import aws_sqs_queue.low_confidence_queue https://sqs.us-east-1.amazonaws.com/755453699050/teraspot-low-confidence-dev
terraform import aws_sqs_queue.dlq_queue https://sqs.us-east-1.amazonaws.com/755453699050/teraspot-dlq-dev

# 2. Import SNS Topic
echo "Importing SNS Topic..."
terraform import aws_sns_topic.alerts_topic arn:aws:sns:us-east-1:755453699050:alertas-teraspot

echo "Import Complete! Now run 'terraform plan' to verify."
