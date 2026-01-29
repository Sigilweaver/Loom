#!/bin/bash
# =============================================================================
# Sigilweaver Docker Build Script
# =============================================================================
# Builds production Docker images for ghcr.io.
# Uses --network=host to work around Docker-in-Docker DNS issues.
#
# Usage:
#   ./build.sh                    # Build both images with :latest tag
#   ./build.sh hub                # Build Hub only
#   ./build.sh server             # Build Server only
#   VERSION=1.0.0 ./build.sh      # Build with specific version tag
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

VERSION="${VERSION:-latest}"
REGISTRY="ghcr.io/sigilweaver"

build_hub() {
    echo "Building $REGISTRY/sigilweaver-hub:$VERSION..."
    docker build \
        --network=host \
        -f hub/Dockerfile \
        -t "$REGISTRY/sigilweaver-hub:$VERSION" \
        .
    echo "Hub image built: $REGISTRY/sigilweaver-hub:$VERSION"
}

build_server() {
    echo "Building $REGISTRY/sigilweaver-server:$VERSION..."
    docker build \
        --network=host \
        -f server/Dockerfile \
        -t "$REGISTRY/sigilweaver-server:$VERSION" \
        .
    echo "Server image built: $REGISTRY/sigilweaver-server:$VERSION"
}

case "${1:-all}" in
    hub)
        build_hub
        ;;
    server)
        build_server
        ;;
    all|"")
        build_hub
        build_server
        echo ""
        echo "All images built successfully."
        docker images | grep sigilweaver
        ;;
    *)
        echo "Usage: $0 [hub|server|all]"
        exit 1
        ;;
esac
