output "api_gateway_url" {
  description = "Base URL for API Gateway stage"
  value       = aws_api_gateway_stage.dev_stage.invoke_url
}

output "config_endpoint" {
  description = "Full URL for the config endpoint"
  value       = "${aws_api_gateway_stage.dev_stage.invoke_url}/config"
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket created"
  value       = aws_s3_bucket.config_bucket.id
}
