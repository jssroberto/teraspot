output "sqs_endpoints" {
  value = {
    alerts_url         = aws_sqs_queue.alerts_queue.url
    low_confidence_url = aws_sqs_queue.low_confidence_queue.url
    dlq_url            = aws_sqs_queue.dlq.url
  }
  description = "SQS queue URLs for environment variables"
}

output "sqs_arns" {
  value = {
    alerts_arn         = aws_sqs_queue.alerts_queue.arn
    low_confidence_arn = aws_sqs_queue.low_confidence_queue.arn
    dlq_arn            = aws_sqs_queue.dlq.arn
  }
  description = "SQS queue ARNs for IAM policies"
}
