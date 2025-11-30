variable "aws_region" {
  description = "AWS Region"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Name of the S3 bucket for configurations"
  type        = string
  default     = "teraspot-config-dev"
}

variable "lambda_function_name" {
  description = "Name of the Lambda function"
  type        = string
  default     = "teraspot-config-saver"
}

variable "environment" {
  description = "Deployment environment (e.g., dev, prod)"
  type        = string
  default     = "dev"
}

variable "iot_endpoint" {
  description = "AWS IoT Core Endpoint"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table for parking spaces"
  type        = string
  default     = "parking-spaces-dev"
}
