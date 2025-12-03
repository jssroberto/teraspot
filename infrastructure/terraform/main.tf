provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

# ==============================================================================
# S3 Bucket
# ==============================================================================
resource "aws_s3_bucket" "config_bucket" {
  bucket = var.bucket_name
  
  # Prevent accidental deletion of the bucket
  force_destroy = true 

  tags = {
    Name        = "TeraSpot Config Bucket"
    Environment = var.environment
  }
}

# ==============================================================================
# IAM Role for Lambda
# ==============================================================================
resource "aws_iam_role" "lambda_role" {
  name = "${var.lambda_function_name}_role"

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
}

# Policy for S3 and CloudWatch Logs
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.lambda_function_name}_policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.config_bucket.arn,
          "${aws_s3_bucket.config_bucket.arn}/*"
        ]
      }
    ]
  })
}

# ==============================================================================
# Lambda Function
# ==============================================================================
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_file = "${path.module}/../../backend/lambdas/config_saver/lambda_function.py"
  output_path = "${path.module}/lambda_function.zip"
}

resource "aws_lambda_function" "config_saver" {
  filename         = data.archive_file.lambda_zip.output_path
  function_name    = var.lambda_function_name
  role             = aws_iam_role.lambda_role.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  runtime          = "python3.13"
  timeout          = 10

  environment {
    variables = {
      CONFIG_BUCKET_NAME = aws_s3_bucket.config_bucket.id
    }
  }
}

# ==============================================================================
# KPI Monitor - Lambda & API Gateway (POST)
# ==============================================================================

data "archive_file" "kpi_monitor_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../backend/lambdas/kpi_monitor"
  output_path = "${path.module}/kpi_monitor.zip"
}

resource "aws_iam_role" "kpi_monitor_role" {
  name = "teraspot_kpi_monitor_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy" "kpi_monitor_policy" {
  name = "teraspot_kpi_monitor_policy"
  role = aws_iam_role.kpi_monitor_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:Scan", "dynamodb:Query", "dynamodb:GetItem"], Resource = "*" } # Ajusta Resource a tus tablas si prefieres más seguridad
    ]
  })
}

resource "aws_lambda_function" "kpi_monitor" {
  filename         = data.archive_file.kpi_monitor_zip.output_path
  function_name    = "teraspot-kpi-monitor"
  role             = aws_iam_role.kpi_monitor_role.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.kpi_monitor_zip.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30
  environment {
    variables = {
      HISTORY_TABLE = "parking-history"
      CURRENT_TABLE_NAME = "parking-spaces-dev"
    }
  }
}



# ==============================================================================
# API Gateway
# ==============================================================================
resource "aws_api_gateway_rest_api" "api" {
  name        = "teraspot-api"
  description = "TeraSpot Backend API"
}

resource "aws_api_gateway_resource" "config_resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "config"
}

resource "aws_api_gateway_method" "post_config" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.config_resource.id
  http_method   = "POST"
  authorization = "NONE" # Open for now, can add Cognito later
}

resource "aws_api_gateway_integration" "lambda_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.config_resource.id
  http_method             = aws_api_gateway_method.post_config.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.config_saver.invoke_arn
}

# CORS for /config
resource "aws_api_gateway_method" "options_config" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.config_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_config_integration" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.config_resource.id
  http_method = aws_api_gateway_method.options_config.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_config_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.config_resource.id
  http_method = aws_api_gateway_method.options_config.http_method
  status_code = "200"
  response_models = {
    "application/json" = "Empty"
  }
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_config_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.config_resource.id
  http_method = aws_api_gateway_method.options_config.http_method
  status_code = aws_api_gateway_method_response.options_config_response.status_code
  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.options_config_response]
}

# Deployment
# Deployment
resource "aws_api_gateway_deployment" "deployment" {
  depends_on = [
    aws_api_gateway_integration.lambda_integration,
    aws_api_gateway_integration.command_integration,
    aws_api_gateway_integration.status_integration,
    aws_api_gateway_integration.options_config_integration,
    aws_api_gateway_integration.options_command_integration
  ]

  rest_api_id = aws_api_gateway_rest_api.api.id
  
  # Force redeployment when code changes
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.config_resource.id,
      aws_api_gateway_method.post_config.id,
      aws_api_gateway_integration.lambda_integration.id,
      aws_api_gateway_method.options_config.id,
      aws_api_gateway_integration.options_config_integration.id,
      aws_api_gateway_method.options_command.id,
      aws_api_gateway_integration.options_command_integration.id,
      timestamp()
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_api_gateway_stage" "dev_stage" {
  deployment_id = aws_api_gateway_deployment.deployment.id
  rest_api_id   = aws_api_gateway_rest_api.api.id
  stage_name    = var.environment
}

# ==============================================================================
# Lambda Permission for API Gateway
# ==============================================================================
resource "aws_lambda_permission" "apigw_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.config_saver.function_name
  principal     = "apigateway.amazonaws.com"

  # More specific source arn is better security practice
  source_arn = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# ==============================================================================
# Device Command Lambda
# ==============================================================================
data "archive_file" "device_command_zip" {
  type        = "zip"
  source_file = "${path.module}/../../backend/lambdas/device_command/lambda_function.py"
  output_path = "${path.module}/device_command.zip"
}

resource "aws_iam_role" "device_command_role" {
  name = "teraspot_device_command_role"

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
}

resource "aws_iam_role_policy" "device_command_policy" {
  name = "teraspot_device_command_policy"
  role = aws_iam_role.device_command_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "iot:Publish"
        ]
        Resource = "*" # Restrict to specific topic in prod
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = [
          "${aws_s3_bucket.config_bucket.arn}/screenshots/*"
        ]
      }
    ]
  })
}

resource "aws_lambda_function" "device_command" {
  filename         = data.archive_file.device_command_zip.output_path
  function_name    = "teraspot-device-command"
  role             = aws_iam_role.device_command_role.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.device_command_zip.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      SCREENSHOT_BUCKET = aws_s3_bucket.config_bucket.id # Using same bucket for now as per user request
      IOT_ENDPOINT      = var.iot_endpoint # Needs to be added to variables
    }
  }
}

# ==============================================================================
# API Gateway - Device Command
# ==============================================================================
resource "aws_api_gateway_resource" "device_resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "device"
}

resource "aws_api_gateway_resource" "device_id_resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.device_resource.id
  path_part   = "{device_id}"
}

resource "aws_api_gateway_resource" "kpi_resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "kpi"
}

resource "aws_api_gateway_resource" "command_resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_resource.device_id_resource.id
  path_part   = "command"
}

resource "aws_api_gateway_method" "post_command" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.command_resource.id
  http_method   = "POST"
  authorization = "NONE"
}

#Route for  kpi endpoint
resource "aws_api_gateway_method" "post_kpi" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.kpi_resource.id
  http_method   = "POST"  
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "kpi_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.kpi_resource.id
  http_method             = aws_api_gateway_method.post_kpi.http_method
  integration_http_method = "POST" # AWS requiere POST interno para invocar
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.kpi_monitor.invoke_arn
}

resource "aws_lambda_permission" "apigw_kpi_lambda" {
  statement_id  = "AllowExecutionFromAPIGatewayKPI"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.kpi_monitor.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

resource "aws_api_gateway_integration" "command_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.command_resource.id
  http_method             = aws_api_gateway_method.post_command.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.device_command.invoke_arn
}

# CORS for /device/{device_id}/command
resource "aws_api_gateway_method" "options_command" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.command_resource.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "options_command_integration" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.command_resource.id
  http_method = aws_api_gateway_method.options_command.http_method
  type        = "MOCK"
  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

resource "aws_api_gateway_method_response" "options_command_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.command_resource.id
  http_method = aws_api_gateway_method.options_command.http_method
  status_code = "200"
  
  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true,
    "method.response.header.Access-Control-Allow-Methods" = true,
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

resource "aws_api_gateway_integration_response" "options_command_integration_response" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  resource_id = aws_api_gateway_resource.command_resource.id
  http_method = aws_api_gateway_method.options_command.http_method
  status_code = aws_api_gateway_method_response.options_command_response.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'",
    "method.response.header.Access-Control-Allow-Methods" = "'GET,OPTIONS,POST,PUT'",
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
  depends_on = [aws_api_gateway_method_response.options_command_response]
}

resource "aws_lambda_permission" "apigw_command_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.device_command.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}


# ==============================================================================
# Read Status Lambda
# ==============================================================================
data "archive_file" "read_status_zip" {
  type        = "zip"
  source_file = "${path.module}/../../backend/lambdas/read_status/lambda_function.py"
  output_path = "${path.module}/read_status.zip"
}

resource "aws_iam_role" "read_status_role" {
  name = "teraspot_read_status_role"

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
}

resource "aws_iam_role_policy" "read_status_policy" {
  name = "teraspot_read_status_policy"
  role = aws_iam_role.read_status_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Scan",
          "dynamodb:Query"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.dynamodb_table_name}"
      }
    ]
  })
}

resource "aws_lambda_function" "read_status" {
  filename         = data.archive_file.read_status_zip.output_path
  function_name    = "teraspot-read-status"
  role             = aws_iam_role.read_status_role.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.read_status_zip.output_base64sha256
  runtime          = "python3.13"
  timeout          = 10

  environment {
    variables = {
      DYNAMODB_TABLE_NAME = var.dynamodb_table_name
    }
  }
}

# ==============================================================================
# API Gateway - Read Status
# ==============================================================================
resource "aws_api_gateway_resource" "status_resource" {
  rest_api_id = aws_api_gateway_rest_api.api.id
  parent_id   = aws_api_gateway_rest_api.api.root_resource_id
  path_part   = "status"
}

resource "aws_api_gateway_method" "get_status" {
  rest_api_id   = aws_api_gateway_rest_api.api.id
  resource_id   = aws_api_gateway_resource.status_resource.id
  http_method   = "GET"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "status_integration" {
  rest_api_id             = aws_api_gateway_rest_api.api.id
  resource_id             = aws_api_gateway_resource.status_resource.id
  http_method             = aws_api_gateway_method.get_status.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.read_status.invoke_arn
}

resource "aws_lambda_permission" "apigw_read_status_lambda" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.read_status.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.api.execution_arn}/*/*"
}

# ==============================================================================
# Ingest Status Lambda
# ==============================================================================
data "archive_file" "ingest_status_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../../backend/lambdas/ingest_status"
  output_path = "${path.module}/ingest_status.zip"
}

resource "aws_iam_role" "ingest_status_role" {
  name = "teraspot_ingest_status_role"

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
}

resource "aws_iam_role_policy" "ingest_status_policy" {
  name = "teraspot_ingest_status_policy"
  role = aws_iam_role.ingest_status_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:BatchWriteItem",
          "dynamodb:GetItem"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.dynamodb_table_name}"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem"
        ]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/parking-history"
      }
    ]
  })
}

resource "aws_lambda_function" "ingest_status" {
  filename         = data.archive_file.ingest_status_zip.output_path
  function_name    = "teraspot-ingest-status"
  role             = aws_iam_role.ingest_status_role.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.ingest_status_zip.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30

  environment {
    variables = {
      DYNAMODB_TABLE = var.dynamodb_table_name
      HISTORY_TABLE  = "parking-history"
    }
  }
}

# ==============================================================================
# IoT Rule
# ==============================================================================
resource "aws_iot_topic_rule" "ingest_rule" {
  name        = "teraspot_status_ingest"
  enabled     = true
  sql         = "SELECT * FROM 'teraspot/+/+/+/status'"
  sql_version = "2016-03-23"

  lambda {
    function_arn = aws_lambda_function.ingest_status.arn
  }
}

resource "aws_lambda_permission" "iot_ingest_lambda" {
  statement_id  = "AllowExecutionFromIoT"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ingest_status.function_name
  principal     = "iot.amazonaws.com"
  source_arn    = aws_iot_topic_rule.ingest_rule.arn
}

# ==============================================================================
# Analytics & Alerts (SQS + SNS + Lambda)
# ==============================================================================

# 1. SQS Queues (Imported)
resource "aws_sqs_queue" "alerts_queue" {
  name = "teraspot-alerts-dev"
}

resource "aws_sqs_queue" "low_confidence_queue" {
  name = "teraspot-low-confidence-dev"
}

resource "aws_sqs_queue" "dlq_queue" {
  name = "teraspot-dlq-dev"
}

# 2. SNS Topic (Imported)
resource "aws_sns_topic" "alerts_topic" {
  name = "alertas-teraspot"
}

# Link SQS to SNS (Optional: If you want SQS to subscribe to SNS, or vice versa)
# For now, we assume the Lambda writes to SQS, and maybe SQS triggers SNS? 
# Or Lambda writes to SQS for buffering? 
# Based on code: Lambda -> SQS. 
# We will leave the SNS topic definition here so it is managed.

# 3. Analytics Lambda
data "archive_file" "analytics_zip" {
  type        = "zip"
  source_file = "${path.module}/../../backend/lambdas/analytics_notifier/lambda_function.py"
  output_path = "${path.module}/analytics_notifier.zip"
}

resource "aws_iam_role" "analytics_role" {
  name = "teraspot_analytics_role"

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
}

resource "aws_iam_role_policy" "analytics_policy" {
  name = "teraspot_analytics_policy"
  role = aws_iam_role.analytics_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:DescribeStream",
          "dynamodb:ListStreams",
          "dynamodb:PutItem" # For history table
        ]
        Resource = [
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.dynamodb_table_name}",
          "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${var.dynamodb_table_name}/stream/*",
           "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/parking-history" # Hardcoded for now based on lambda
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage"
        ]
        Resource = [
          aws_sqs_queue.alerts_queue.arn,
          aws_sqs_queue.low_confidence_queue.arn,
          aws_sqs_queue.dlq_queue.arn
        ]
      },
      {
        Effect = "Allow"
        Action = ["dynamodb:Scan", "dynamodb:DeleteItem"]
        Resource = aws_dynamodb_table.connections_table.arn
      },
      {
        Effect = "Allow"
        Action = ["execute-api:ManageConnections"]
        Resource = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*"
      }
    ]
  })
}

resource "aws_lambda_function" "analytics_notifier" {
  filename         = data.archive_file.analytics_zip.output_path
  function_name    = "teraspot-analytics-notifier"
  role             = aws_iam_role.analytics_role.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.analytics_zip.output_base64sha256
  runtime          = "python3.12"
  timeout          = 30

  environment {
    variables = {
      SQS_ALERTS_URL         = aws_sqs_queue.alerts_queue.id
      SQS_LOW_CONFIDENCE_URL = aws_sqs_queue.low_confidence_queue.id
      DLQ_URL                = aws_sqs_queue.dlq_queue.id
      HISTORY_TABLE          = "parking-history"
      DYNAMODB_TABLE         = var.dynamodb_table_name
      CONNECTIONS_TABLE      = aws_dynamodb_table.connections_table.name
      WEBSOCKET_CALLBACK_URL = replace(aws_apigatewayv2_stage.ws_stage.invoke_url, "wss://", "https://")
    }
  }
}

# 4. DynamoDB Stream Trigger
# NOTE: This requires Streams to be enabled on the DynamoDB table manually or via Terraform.
# Since we are not managing the table resource fully here (it's referenced by name in variables),
# we assume the stream exists. We need to look it up.

data "aws_dynamodb_table" "parking_table" {
  name = var.dynamodb_table_name
}

resource "aws_lambda_event_source_mapping" "dynamodb_stream" {
  event_source_arn  = data.aws_dynamodb_table.parking_table.stream_arn
  function_name     = aws_lambda_function.analytics_notifier.arn
  starting_position = "LATEST"
  batch_size        = 10
  enabled           = true
}

# ==============================================================================
# ECR Repository (Fog Node)
# ==============================================================================
resource "aws_ecr_repository" "fog_repo" {
  name                 = "teraspot-fog"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = false
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  # Prevent accidental deletion of the registry and images
  lifecycle {
    prevent_destroy = true
  }
}

# ==============================================================================
# CI/CD IAM User & Permissions
# ==============================================================================
resource "aws_iam_user" "ci_user" {
  name = "teraspot-github-ci"
  
  # Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }
}

# Attach ECR PowerUser policy to the CI user
resource "aws_iam_user_policy_attachment" "ci_user_ecr_policy" {
  user       = aws_iam_user.ci_user.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser"
}

# Attach existing policies (to match current AWS state)
resource "aws_iam_user_policy_attachment" "ci_user_dynamodb_policy" {
  user       = aws_iam_user.ci_user.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

resource "aws_iam_user_policy_attachment" "ci_user_s3_policy" {
  user       = aws_iam_user.ci_user.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

resource "aws_iam_user_policy_attachment" "ci_user_timestream_policy" {
  user       = aws_iam_user.ci_user.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonTimestreamFullAccess"
}

resource "aws_iam_user_policy_attachment" "ci_user_lambda_policy" {
  user       = aws_iam_user.ci_user.name
  policy_arn = "arn:aws:iam::aws:policy/AWSLambda_FullAccess"
}


# ==============================================================================
# Cognito Authentication
# ==============================================================================
resource "aws_cognito_user_pool" "admin_pool" {
  name = "teraspot-admin-pool-${var.environment}"

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = false
    require_uppercase = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }
}

resource "aws_cognito_user_pool_client" "admin_client" {
  name = "teraspot-admin-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.admin_pool.id
  
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]
}

# ==============================================================================
# WebSocket Infrastructure
# ==============================================================================

# 1. DynamoDB Connections Table
resource "aws_dynamodb_table" "connections_table" {
  name           = "teraspot-connections-${var.environment}"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "connection_id"

  attribute {
    name = "connection_id"
    type = "S"
  }

  tags = {
    Environment = var.environment
  }
}

# 2. WebSocket API Gateway
resource "aws_apigatewayv2_api" "websocket_api" {
  name                       = "teraspot-websocket-api-${var.environment}"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
}

# 3. Lambdas for Connection Management

# --- Connect Lambda ---
data "archive_file" "ws_connect_zip" {
  type        = "zip"
  source_file = "${path.module}/../../backend/lambdas/ws_connect/lambda_function.py"
  output_path = "${path.module}/ws_connect.zip"
}

resource "aws_iam_role" "ws_connect_role" {
  name = "teraspot_ws_connect_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy" "ws_connect_policy" {
  name = "teraspot_ws_connect_policy"
  role = aws_iam_role.ws_connect_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:PutItem"], Resource = aws_dynamodb_table.connections_table.arn }
    ]
  })
}

resource "aws_lambda_function" "ws_connect" {
  filename         = data.archive_file.ws_connect_zip.output_path
  function_name    = "teraspot-ws-connect"
  role             = aws_iam_role.ws_connect_role.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.ws_connect_zip.output_base64sha256
  runtime          = "python3.12"
  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.connections_table.name
    }
  }
}

# --- Disconnect Lambda ---
data "archive_file" "ws_disconnect_zip" {
  type        = "zip"
  source_file = "${path.module}/../../backend/lambdas/ws_disconnect/lambda_function.py"
  output_path = "${path.module}/ws_disconnect.zip"
}

resource "aws_iam_role" "ws_disconnect_role" {
  name = "teraspot_ws_disconnect_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17", Statement = [{ Action = "sts:AssumeRole", Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" } }]
  })
}

resource "aws_iam_role_policy" "ws_disconnect_policy" {
  name = "teraspot_ws_disconnect_policy"
  role = aws_iam_role.ws_disconnect_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:*:*:*" },
      { Effect = "Allow", Action = ["dynamodb:DeleteItem"], Resource = aws_dynamodb_table.connections_table.arn }
    ]
  })
}

resource "aws_lambda_function" "ws_disconnect" {
  filename         = data.archive_file.ws_disconnect_zip.output_path
  function_name    = "teraspot-ws-disconnect"
  role             = aws_iam_role.ws_disconnect_role.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.ws_disconnect_zip.output_base64sha256
  runtime          = "python3.12"
  environment {
    variables = {
      CONNECTIONS_TABLE = aws_dynamodb_table.connections_table.name
    }
  }
}

# 4. API Gateway Integrations & Routes

# $connect
resource "aws_apigatewayv2_integration" "ws_connect_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.ws_connect.invoke_arn
}

resource "aws_apigatewayv2_route" "ws_connect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$connect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_connect_integration.id}"
}

resource "aws_lambda_permission" "apigw_ws_connect" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_connect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# $disconnect
resource "aws_apigatewayv2_integration" "ws_disconnect_integration" {
  api_id           = aws_apigatewayv2_api.websocket_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = aws_lambda_function.ws_disconnect.invoke_arn
}

resource "aws_apigatewayv2_route" "ws_disconnect_route" {
  api_id    = aws_apigatewayv2_api.websocket_api.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.ws_disconnect_integration.id}"
}

resource "aws_lambda_permission" "apigw_ws_disconnect" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.ws_disconnect.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket_api.execution_arn}/*/*"
}

# 5. Deployment & Stage
resource "aws_apigatewayv2_stage" "ws_stage" {
  api_id      = aws_apigatewayv2_api.websocket_api.id
  name        = var.environment
  auto_deploy = true
}

# ==============================================================================
# Outputs
# ==============================================================================
output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.admin_pool.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.admin_client.id
}

output "websocket_url" {
  value = aws_apigatewayv2_stage.ws_stage.invoke_url
}

output "websocket_callback_url" {
  value = replace(aws_apigatewayv2_stage.ws_stage.invoke_url, "wss://", "https://")
}
