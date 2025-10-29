#!/bin/bash
set -e

echo "=========================================="
echo "Building Sigilweaver Complete Application"
echo "=========================================="

# Get script directory and navigate to project root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# Determine platform
PLATFORM="${1:-linux}"

echo ""
echo "Target platform: $PLATFORM"
echo ""

# Build backend executable
echo "Step 1/2: Building backend executable..."
echo "------------------------------------------"
"$SCRIPT_DIR/build_backend.sh"

echo ""
echo "Step 2/2: Building frontend + Electron..."
echo "------------------------------------------"
cd frontend

case "$PLATFORM" in
  linux)
    npm run build:linux
    ;;
  win|windows)
    npm run build:win
    ;;
  mac|macos)
    npm run build:mac
    ;;
  *)
    echo "Unknown platform: $PLATFORM"
    echo "Usage: $0 [linux|win|mac]"
    exit 1
    ;;
esac

cd ..

echo ""
echo "=========================================="
echo "Build complete!"
echo "=========================================="
echo ""
echo "Output location: frontend/dist/"
ls -lh frontend/dist/
