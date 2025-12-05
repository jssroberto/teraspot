# Script to build and push the Fog Docker image to ECR

$Region = "us-east-1"
$RepoName = "teraspot-fog"
$AccountId = aws sts get-caller-identity --query Account --output text --no-cli-pager

if (-not $AccountId) {
    Write-Host "Error: Could not get AWS Account ID. Please ensure you are logged in via AWS CLI." -ForegroundColor Red
    exit 1
}

$RepoUri = "$AccountId.dkr.ecr.$Region.amazonaws.com/$RepoName"

Write-Host "Logging in to ECR..."
# Use cmd /c to avoid PowerShell pipe encoding issues
cmd /c "aws ecr get-login-password --region $Region --no-cli-pager | docker login --username AWS --password-stdin $AccountId.dkr.ecr.$Region.amazonaws.com"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: ECR Login failed." -ForegroundColor Red
    exit 1
}

Write-Host "Building Docker image..."
docker build -t $RepoName -f fog/Dockerfile fog/

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker build failed." -ForegroundColor Red
    exit 1
}

Write-Host "Tagging image..."
docker tag "$RepoName`:latest" "$RepoUri`:latest"

Write-Host "Pushing image to ECR..."
docker push "$RepoUri`:latest"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Docker push failed." -ForegroundColor Red
    exit 1
}

Write-Host "Successfully pushed $RepoUri`:latest" -ForegroundColor Green
