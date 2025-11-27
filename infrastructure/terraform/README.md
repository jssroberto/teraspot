# TeraSpot Infrastructure (Terraform)

This directory contains the Terraform configuration to manage the AWS infrastructure for the TeraSpot backend.

## Resources Managed

- **API Gateway**: A REST API (`teraspot-api`) that exposes the backend logic.
  - Endpoint: `/config` (POST)
  - Integration: AWS Lambda Proxy
- **Lambda Function**: `teraspot-config-saver` (Imported).
  - This function is updated with the correct IAM role and environment variables.
- **S3 Bucket**: `teraspot-config-dev`
  - Stores the configuration JSON files.
- **IAM Roles & Policies**:
  - Execution role for the Lambda with permissions to access S3 and CloudWatch Logs.
  - Permission for API Gateway to invoke the Lambda.

## Prerequisites

- Terraform v1.0+
- AWS CLI configured with appropriate credentials.

## Usage

### 1. Initialize

Initialize the Terraform working directory. This downloads the necessary providers.

```bash
terraform init
```

### 2. Plan

Preview the changes that Terraform will make to your infrastructure.

```bash
terraform plan
```

### 3. Apply

Apply the changes to deploy the infrastructure.

```bash
terraform apply
```

## Outputs

After a successful apply, Terraform will output:

- `api_gateway_url`: The base URL for the API Gateway.
- `config_endpoint`: The full URL for the configuration endpoint.
- `s3_bucket_name`: The name of the created S3 bucket.

## Notes

- **State Management**: The Terraform state is currently stored locally (`terraform.tfstate`). Do not commit this file to version control if it contains sensitive information (though currently it does not).
- **Imported Resources**: The `teraspot-config-saver` Lambda was imported into this state. If you destroy this infrastructure, that Lambda will be deleted.
