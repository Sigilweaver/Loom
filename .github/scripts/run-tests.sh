#!/bin/bash
set -euo pipefail

# Run pytest with coverage for GitHub Actions scripts

cd "$(dirname "$0")/.."

echo "Running tests for the release scripts..."
echo ""

python3 -m pytest tests/ \
    --verbose \
    --color=yes \
    --tb=short \
    "$@"

echo ""
echo "All tests passed!"
