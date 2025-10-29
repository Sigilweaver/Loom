#!/bin/bash
set -e

echo "=========================================="
echo "Running Frontend Tests"
echo "=========================================="

# Navigate to frontend directory
cd "$(dirname "$0")/../frontend"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "ERROR: node_modules not found!"
    echo "Please run: npm install"
    exit 1
fi

echo ""
echo "Running unit tests..."
echo "------------------------------------------"
npm run test:unit

echo ""
echo "=========================================="
echo "Frontend tests complete!"
echo "=========================================="
