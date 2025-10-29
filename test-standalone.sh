#!/bin/bash
# Quick test of the standalone package without full rebuild

set -e

cd "$(dirname "$0")"

# Check if backend executable exists
if [ ! -f "sigilweaver-backend/dist/sigilweaver-backend" ] && [ ! -f "sigilweaver-backend/dist/sigilweaver-backend.exe" ]; then
    echo "ERROR: Backend executable not found!"
    echo "Run: ./build-all.sh first"
    exit 1
fi

# Check if frontend is built
if [ ! -d "sigilweaver-frontend/dist-electron" ]; then
    echo "ERROR: Frontend not built!"
    echo "Run: cd sigilweaver-frontend && npm run build:web"
    exit 1
fi

# Find the unpacked directory
if [ -d "sigilweaver-frontend/dist/linux-unpacked" ]; then
    UNPACKED="sigilweaver-frontend/dist/linux-unpacked"
elif [ -d "sigilweaver-frontend/dist/win-unpacked" ]; then
    UNPACKED="sigilweaver-frontend/dist/win-unpacked"
elif [ -d "sigilweaver-frontend/dist/mac" ]; then
    UNPACKED="sigilweaver-frontend/dist/mac/Sigilweaver.app/Contents/MacOS"
else
    echo "ERROR: No unpacked build found"
    echo "Run: ./build-all.sh first"
    exit 1
fi

echo "Testing standalone package..."
echo "Unpacked location: $UNPACKED"
echo ""
echo "Starting application..."
echo "Watch for [Backend] messages in the console!"
echo ""

"$UNPACKED/sigilweaver"
