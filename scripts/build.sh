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
echo "Step 1/3: Building backend executable..."
echo "------------------------------------------"
"$SCRIPT_DIR/build_backend.sh"

echo ""
echo "Step 2/3: Copying backend to resources..."
echo "------------------------------------------"

# Create resources/backend directory
mkdir -p frontend/resources/backend

# Determine file extension based on platform
if [[ "$PLATFORM" == "win" ]] || [[ "$PLATFORM" == "windows" ]]; then
    BACKEND_EXT=".exe"
else
    BACKEND_EXT=""
fi

# Copy the backend executable to frontend resources
BACKEND_SRC="backend/dist/backend${BACKEND_EXT}"
BACKEND_DEST="frontend/resources/backend/backend${BACKEND_EXT}"

if [ -f "$BACKEND_SRC" ]; then
    cp "$BACKEND_SRC" "$BACKEND_DEST"
    chmod +x "$BACKEND_DEST"
    echo "Backend copied to: $BACKEND_DEST"
    ls -lh "$BACKEND_DEST"
else
    echo "ERROR: Backend executable not found at $BACKEND_SRC"
    exit 1
fi

echo ""
echo "Step 3/3: Building frontend + Electron..."
echo "------------------------------------------"
cd frontend

case "$PLATFORM" in
  linux)
    npm run build:linux:full
    ;;
  win|windows)
    npm run build:win:full
    ;;
  mac|macos)
    npm run build:mac:full
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
