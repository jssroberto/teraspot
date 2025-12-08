# Terraform Guide

## Prerequisites
*   [Terraform CLI](https://developer.hashicorp.com/terraform/install) installed.
*   AWS CLI configurated (`aws configure`).

## Workflow

### 1. Initialize
Downloads the provider plugins (AWS) and sets up the backend.
```bash
cd infrastructure/terraform
terraform init
```

### 2. Plan
Preview what changes will be made. Always run this before applying.
```bash
terraform plan
```

### 3. Apply
 Execute the changes against the real AWS environment.
```bash
terraform apply
# Type 'yes' to confirm
```

### 4. Updating Lambda Configuration
If you add a new Environment Variable to a Lambda:
1.  Edit `main.tf`.
2.  Add the key-value pair to the `environment { variables = { ... } }` block.
3.  Run `terraform apply`.

## State Management
The state file `terraform.tfstate` maps your local code to real world IDs resources (e.g., `aws_s3_bucket.my_bucket` -> `bucket-12345`).
**WARNING**: Do not manually edit this file. If it gets out of sync, Terraform may try to delete and recreate everything.
