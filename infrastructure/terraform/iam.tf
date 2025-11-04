# backend/infrastructure/terraform/iam.tf

resource "aws_iam_role" "lambda_role" {
  name = "teraspot-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "TeraSpot Lambda Role"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy" "lambda_permissions" {
  name = "teraspot-lambda-policy-${var.environment}"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.alerts_queue.arn,
          aws_sqs_queue.low_confidence_queue.arn,
          aws_sqs_queue.dlq.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:GetItem"
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:*:table/parking-spaces*",
          "arn:aws:dynamodb:${var.aws_region}:*:table/parking-history*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

output "lambda_role_arn" {
  value       = aws_iam_role.lambda_role.arn
  description = "ARN of Lambda execution role"
}

output "lambda_role_name" {
  value       = aws_iam_role.lambda_role.name
  description = "Name of Lambda execution role"
}
