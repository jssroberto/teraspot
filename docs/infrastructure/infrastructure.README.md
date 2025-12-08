# Infrastructure Documentation

## Overview
TeraSpot uses **Infrastructure as Code (IaC)** to manage its AWS resources. This ensures reproducibility and version control.

**Tool**: [Terraform](https://www.terraform.io/)
**State Storage**: Local (`terraform.tfstate` tracked in git - *Note: In a real team, this should be remote S3 backend*).

## Management Strategy
We use a hybrid approach:
1.  **Terraform**: Provisions the "Skeleton" (Tables, Buckets, IAM Roles, Empty Lambda Functions, API Gateway).
2.  **GitHub Actions**: Deploys the "Flesh" (Application Code).

*Why?* This prevents Terraform from needing to re-upload 50MB zip files every time you change one line of Python code. Terraform manages *architecture*, CI/CD manages *releases*.

## Directory Structure
*   `infrastructure/terraform/`: The Terraform HCL code.
*   `infrastructure/cloudformation/`: Legacy templates (deprecated).

## Detailed Documentation
*   **[Terraform Guide](./infrastructure.TERRAFORM.md)**: How to apply changes.
*   **[Resource Inventory](./infrastructure.RESOURCES.md)**: List of what is actually deployed.
