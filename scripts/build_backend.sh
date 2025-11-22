#!/bin/bash
set -e

echo "=========================================="
echo "Building Sigilweaver Backend Executable"
echo "=========================================="

# Change to backend directory (from scripts/)
cd "$(dirname "$0")/../backend"

# Check if virtual environment exists
if [ ! -d ".venv" ]; then
    echo "ERROR: Virtual environment not found!"
    echo "Please run: python -m venv .venv && source .venv/bin/activate && pip install -e \".[build]\""
    exit 1
fi

# Activate virtual environment
source .venv/bin/activate

# Install build dependencies
echo "Installing build dependencies..."
pip install -e ".[build]" > /dev/null

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf build dist

# Build with PyInstaller
echo "Building executable with PyInstaller..."
pyinstaller sigilweaver.spec --clean

# Check if build succeeded
if [ -f "dist/backend" ] || [ -f "dist/backend.exe" ]; then
    echo ""
    echo "=========================================="
    echo "Build successful!"
    echo "=========================================="
    if [ -f "dist/backend" ]; then
        ls -lh dist/backend
    else
        ls -lh dist/backend.exe
    fi
else
    echo ""
    echo "=========================================="
    echo "Build failed!"
    echo "=========================================="
    exit 1
fi
