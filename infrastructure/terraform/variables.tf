variable "aws_region" {
  type        = string
  description = "AWS region"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Environment (dev, staging, prod)"
  default     = "dev"
}

variable "project_name" {
  type        = string
  description = "Project name"
  default     = "teraspot"
}

variable "alert_retention_hours" {
  type        = number
  description = "Hours to retain alert messages"
  default     = 24
}

variable "dlq_retention_hours" {
  type        = number
  description = "Hours to retain DLQ messages"
  default     = 336 # 14 días
}
