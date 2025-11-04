resource "aws_sqs_queue" "dlq" {
  name = "-dlq-"
  message_retention_seconds = 1209600
  visibility_timeout_seconds = 300
  tags = {
    Name = "TeraSpot DLQ"
  }
}
resource "aws_sqs_queue" "alerts_queue" {
  name = "-alerts-"
  message_retention_seconds = 86400
  visibility_timeout_seconds = 300
}
