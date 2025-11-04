# DynamoDB tables already exist in AWS (created manually)
# Just referencing for documentation purposes

# Nueva tabla: Histórico con timestamp (series temporales)
resource "aws_dynamodb_table" "parking_history" {
  name           = "parking-history"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "space_id"
  range_key      = "timestamp"

  attribute {
    name = "space_id"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }

  tags = {
    Name = "Parking History"
  }
}
