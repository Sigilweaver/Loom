#!/bin/bash
set -e

echo "=========================================="
echo "Running Backend Tests"
echo "=========================================="

# Navigate to backend directory
cd "$(dirname "$0")/../backend"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "ERROR: Virtual environment not found!"
    echo "Please run: python -m venv .venv && source .venv/bin/activate && pip install -e \".[dev]\""
    exit 1
fi

# Activate virtual environment
source .venv/bin/activate

echo ""
echo "Running pytest with coverage..."
echo "------------------------------------------"
pytest tests/ -v --cov=app --cov-report=term --cov-report=html

echo ""
echo "=========================================="
echo "Backend tests complete!"
echo "=========================================="
echo ""
echo "Coverage report: backend/htmlcov/index.html"
