output "parking_history_table" {
  value = aws_dynamodb_table.parking_history.name
  description = "Parking history table (time series)"
}

output "dlq_url" {
  value = aws_sqs_queue.dlq.url
  description = "DLQ URL for Lambda environment variable"
}

output "dlq_arn" {
  value = aws_sqs_queue.dlq.arn
  description = "DLQ ARN"
}

output "lambda_role_arn" {
  value = aws_iam_role.lambda_role.arn
  description = "Lambda IAM role ARN"
}

output "existing_parking_table" {
  value = "parking-spaces"
  description = "Existing DynamoDB table (created manually)"
}
