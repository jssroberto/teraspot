# backend/infrastructure/terraform/sqs.tf
# SQS Resources ONLY (sin variables)

# DLQ (Dead Letter Queue)
resource "aws_sqs_queue" "dlq" {
  name                      = "teraspot-dlq-${var.environment}"
  message_retention_seconds = var.dlq_retention_hours * 3600
  visibility_timeout_seconds = 300
  
  tags = {
    Name        = "TeraSpot DLQ"
    Environment = var.environment
    Component   = "Notifications"
  }
}

# Alerts Queue CON REDRIVE AUTOMÁTICO
resource "aws_sqs_queue" "alerts_queue" {
  name                      = "teraspot-alerts-${var.environment}"
  message_retention_seconds = var.alert_retention_hours * 3600
  visibility_timeout_seconds = 300
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Name        = "TeraSpot Alerts"
    Environment = var.environment
    Component   = "Notifications"
  }
}

# Low Confidence Events Queue
resource "aws_sqs_queue" "low_confidence_queue" {
  name                      = "teraspot-low-confidence-${var.environment}"
  message_retention_seconds = var.alert_retention_hours * 3600
  visibility_timeout_seconds = 300
  
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.dlq.arn
    maxReceiveCount     = 3
  })
  
  tags = {
    Name        = "TeraSpot Low Confidence Events"
    Environment = var.environment
    Component   = "Notifications"
  }
}

# CloudWatch Alarm
resource "aws_cloudwatch_metric_alarm" "dlq_alarm" {
  alarm_name          = "teraspot-dlq-messages-${var.environment}"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = "ApproximateNumberOfMessagesVisible"
  namespace           = "AWS/SQS"
  period              = "300"
  statistic           = "Average"
  threshold           = "1"
  alarm_description   = "Alert when messages appear in DLQ"
  
  dimensions = {
    QueueName = aws_sqs_queue.dlq.name
  }
  
  tags = {
    Name        = "TeraSpot DLQ Alarm"
    Environment = var.environment
  }
}
