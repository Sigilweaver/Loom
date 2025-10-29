#!/bin/bash
# Quick test of the standalone package without full rebuild

set -e

cd "$(dirname "$0")"

# Check if backend executable exists
if [ ! -f "backend/dist/backend" ] && [ ! -f "backend/dist/backend.exe" ]; then
    echo "ERROR: Backend executable not found!"
    echo "Run: ./scripts/build-all.sh first"
    exit 1
fi

# Check if frontend is built
if [ ! -d "frontend/dist-electron" ]; then
    echo "ERROR: Frontend not built!"
    echo "Run: cd frontend && npm run build:web"
    exit 1
fi

# Find the unpacked directory
if [ -d "frontend/dist/linux-unpacked" ]; then
    UNPACKED="frontend/dist/linux-unpacked"
elif [ -d "frontend/dist/win-unpacked" ]; then
    UNPACKED="frontend/dist/win-unpacked"
elif [ -d "frontend/dist/mac" ]; then
    UNPACKED="frontend/dist/mac/Sigilweaver.app/Contents/MacOS"
else
    echo "ERROR: No unpacked build found"
    echo "Run: ./scripts/build-all.sh first"
    exit 1
fi

echo "Testing standalone package..."
echo "Unpacked location: $UNPACKED"
echo ""
echo "Starting application..."
echo "Watch for [Backend] messages in the console!"
echo ""

"$UNPACKED/sigilweaver"
