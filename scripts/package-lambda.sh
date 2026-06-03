#!/bin/bash
set -e

LAMBDA_NAME=$1

if [ -z "$LAMBDA_NAME" ]; then
  echo "Usage: $0 <lambda_directory_name>"
  exit 1
fi

echo "Packaging Lambda: $LAMBDA_NAME..."

LAMBDA_DIR="backend/lambdas/$LAMBDA_NAME"
PACKAGE_DIR="$LAMBDA_DIR/package"
ZIP_FILE="$LAMBDA_DIR/lambda.zip"

# Clean up old packages
rm -rf "$PACKAGE_DIR" "$ZIP_FILE"
mkdir -p "$PACKAGE_DIR"

# 1. Export dependencies from uv workspace lockfile, excluding local workspace members
# Note: we convert underscores to dashes to match pyproject.toml names (e.g. teraspot-ingest-status)
PKG_NAME="teraspot-${LAMBDA_NAME//_/-}"

# Export dependencies omitting workspace members and standard Lambda runtime libraries
uv export \
  --package "$PKG_NAME" \
  --no-emit-workspace \
  --no-emit-package boto3 \
  --no-emit-package botocore \
  --no-emit-package s3transfer \
  --no-emit-package urllib3 \
  --no-emit-package python-dateutil \
  --no-emit-package jmespath \
  --no-emit-package six \
  --output-file "$LAMBDA_DIR/requirements.txt"

# 2. Install external dependencies if any exist
if [ -s "$LAMBDA_DIR/requirements.txt" ] && [ "$(grep -v '^#' "$LAMBDA_DIR/requirements.txt" | grep -v '^\s*$')" ]; then
  echo "Installing external dependencies into package..."
  uv pip install \
    --system \
    --target "$PACKAGE_DIR" \
    -r "$LAMBDA_DIR/requirements.txt"
fi

# Clean up requirements file
rm -f "$LAMBDA_DIR/requirements.txt"

# 3. Copy shared utilities and handler files into package
echo "Copying handler code and shared utilities..."
if [ -d "backend/shared/utils" ]; then
  cp -r backend/shared/utils "$PACKAGE_DIR/"
fi
cp -R "$LAMBDA_DIR"/*.py "$PACKAGE_DIR/" 2>/dev/null || true

# 4. Zip the package directory
cd "$PACKAGE_DIR"
zip -q -r "../lambda.zip" .
cd - > /dev/null

echo "Lambda $LAMBDA_NAME packaged successfully at $ZIP_FILE"
