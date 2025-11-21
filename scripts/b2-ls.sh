#!/usr/bin/env bash
# B2 bucket listing helper script
# Usage: ./scripts/b2-ls.sh [path]
# Examples:
#   ./scripts/b2-ls.sh              # List root
#   ./scripts/b2-ls.sh latest       # List /latest/
#   ./scripts/b2-ls.sh releases     # List /releases/
#   ./scripts/b2-ls.sh -r           # Recursive list all files

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load credentials from .env if it exists
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
else
    echo "ERROR: .env file not found at $PROJECT_ROOT/.env"
    echo "Please create it with your B2 credentials:"
    echo "  B2_APPLICATION_KEY_ID=..."
    echo "  B2_APPLICATION_KEY=..."
    echo "  B2_BUCKET_NAME=..."
    echo "  B2_ENDPOINT_URL=..."
    exit 1
fi

# Verify required variables
if [ -z "${B2_APPLICATION_KEY_ID:-}" ] || [ -z "${B2_APPLICATION_KEY:-}" ] || \
   [ -z "${B2_BUCKET_NAME:-}" ] || [ -z "${B2_ENDPOINT_URL:-}" ]; then
    echo "ERROR: Missing required B2 credentials in .env"
    exit 1
fi

# Configure AWS CLI
export AWS_ACCESS_KEY_ID="${B2_APPLICATION_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${B2_APPLICATION_KEY}"
export AWS_DEFAULT_REGION="us-east-005"
aws configure set s3.signature_version s3v4
aws configure set s3.addressing_style path

# Parse arguments
PATH_ARG="${1:-}"
RECURSIVE=false

if [ "$PATH_ARG" = "-r" ] || [ "$PATH_ARG" = "--recursive" ]; then
    RECURSIVE=true
    PATH_ARG="${2:-}"
fi

# Build S3 path
if [ -z "$PATH_ARG" ]; then
    S3_PATH="s3://$B2_BUCKET_NAME/"
    DISPLAY_PATH="/"
else
    S3_PATH="s3://$B2_BUCKET_NAME/${PATH_ARG%/}/"
    DISPLAY_PATH="/${PATH_ARG%/}/"
fi

echo "=========================================="
echo "B2 Bucket: $B2_BUCKET_NAME"
echo "Path: $DISPLAY_PATH"
echo "=========================================="
echo ""

# List contents
if [ "$RECURSIVE" = true ]; then
    echo "Listing all files recursively..."
    echo ""
    aws s3 ls "$S3_PATH" \
        --recursive \
        --human-readable \
        --summarize \
        --endpoint-url "https://$B2_ENDPOINT_URL"
else
    aws s3 ls "$S3_PATH" \
        --human-readable \
        --endpoint-url "https://$B2_ENDPOINT_URL"
fi

echo ""
echo "=========================================="
echo "To list recursively: $0 -r [path]"
echo "Base URL: https://${B2_BUCKET_NAME}.${B2_ENDPOINT_URL}/"
echo "=========================================="
