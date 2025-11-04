variable "aws_region" {
  default = "us-east-1"
}
variable "environment" {
  default = "dev"
}
variable "project_name" {
  default = "teraspot"
}
variable "parking_table_name" {
  default = "parking-spaces-dev"
}
variable "config_table_name" {
  default = "teraspot-config-dev"
}
variable "timestream_db_name" {
  default = "teraspot-db"
}
variable "retention_days" {
  type = number
  default = 30
}
