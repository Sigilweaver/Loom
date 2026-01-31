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
#   SCAN=1 ./build.sh             # Build and scan for vulnerabilities
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR"

VERSION="${VERSION:-latest}"
REGISTRY="ghcr.io/sigilweaver"
BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
VCS_REF="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
SCAN="${SCAN:-0}"

# Enable BuildKit for cache mounts and other features
export DOCKER_BUILDKIT=1

build_hub() {
    echo "Building $REGISTRY/sigilweaver-hub:$VERSION..."
    docker build \
        --network=host \
        --build-arg VERSION="$VERSION" \
        --build-arg BUILD_DATE="$BUILD_DATE" \
        --build-arg VCS_REF="$VCS_REF" \
        -f hub/Dockerfile \
        -t "$REGISTRY/sigilweaver-hub:$VERSION" \
        .
    echo "Hub image built: $REGISTRY/sigilweaver-hub:$VERSION"

    if [ "$SCAN" = "1" ]; then
        scan_image "$REGISTRY/sigilweaver-hub:$VERSION"
    fi
}

build_server() {
    echo "Building $REGISTRY/sigilweaver-server:$VERSION..."
    docker build \
        --network=host \
        --build-arg VERSION="$VERSION" \
        --build-arg BUILD_DATE="$BUILD_DATE" \
        --build-arg VCS_REF="$VCS_REF" \
        -f server/Dockerfile \
        -t "$REGISTRY/sigilweaver-server:$VERSION" \
        .
    echo "Server image built: $REGISTRY/sigilweaver-server:$VERSION"

    if [ "$SCAN" = "1" ]; then
        scan_image "$REGISTRY/sigilweaver-server:$VERSION"
    fi
}

scan_image() {
    local image="$1"
    echo ""
    echo "Scanning $image for vulnerabilities..."

    # Try docker scout first (Docker Desktop / Docker Hub)
    if command -v docker &>/dev/null && docker scout version &>/dev/null 2>&1; then
        echo "Using Docker Scout..."
        docker scout cves "$image" --only-severity critical,high || true
        docker scout recommendations "$image" || true
    # Fall back to trivy if available
    elif command -v trivy &>/dev/null; then
        echo "Using Trivy..."
        trivy image --severity CRITICAL,HIGH "$image" || true
    # Fall back to grype if available
    elif command -v grype &>/dev/null; then
        echo "Using Grype..."
        grype "$image" --only-fixed --fail-on high || true
    else
        echo "No vulnerability scanner found. Install docker scout, trivy, or grype for security scanning."
        echo "  - Docker Scout: Included with Docker Desktop"
        echo "  - Trivy: https://github.com/aquasecurity/trivy"
        echo "  - Grype: https://github.com/anchore/grype"
    fi
}

print_summary() {
    echo ""
    echo "=============================================="
    echo "Build Summary"
    echo "=============================================="
    echo "Version:    $VERSION"
    echo "Build Date: $BUILD_DATE"
    echo "VCS Ref:    $VCS_REF"
    echo ""
    docker images | grep sigilweaver | head -10
}

case "${1:-all}" in
    hub)
        build_hub
        print_summary
        ;;
    server)
        build_server
        print_summary
        ;;
    all|"")
        build_hub
        build_server
        echo ""
        echo "All images built successfully."
        print_summary
        ;;
    scan)
        # Scan existing images without rebuilding
        SCAN=1
        scan_image "$REGISTRY/sigilweaver-hub:$VERSION"
        scan_image "$REGISTRY/sigilweaver-server:$VERSION"
        ;;
    *)
        echo "Usage: $0 [hub|server|all|scan]"
        echo ""
        echo "Commands:"
        echo "  hub     Build Hub image only"
        echo "  server  Build Server image only"
        echo "  all     Build both images (default)"
        echo "  scan    Scan existing images for vulnerabilities"
        echo ""
        echo "Environment variables:"
        echo "  VERSION  Image tag (default: latest)"
        echo "  SCAN     Set to 1 to scan after building"
        exit 1
        ;;
esac
