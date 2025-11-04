resource "aws_iam_role" "lambda_role" {
  name = "-lambda-role-"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}
resource "aws_iam_role_policy" "lambda_permissions" {
  name = "-lambda-policy"
  role = aws_iam_role.lambda_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["logs:*"]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = ["dynamodb:*"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = ["timestream:*"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = ["sqs:SendMessage"]
        Resource = [aws_sqs_queue.dlq.arn, aws_sqs_queue.alerts_queue.arn]
      },
      {
        Effect = "Allow"
        Action = ["sns:Publish", "ses:SendEmail"]
        Resource = "*"
      }
    ]
  })
}
