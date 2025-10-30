#!/usr/bin/env bash
# Script to update version in both backend and frontend
# Usage: ./scripts/set-version.sh <new_version> [-y|--yes]
# Example: ./scripts/set-version.sh 0.3.0
# Example: ./scripts/set-version.sh 0.3.0 -y  (skip confirmation)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

if [ $# -eq 0 ]; then
    echo -e "${RED}Error: No version provided${NC}"
    echo "Usage: $0 <version> [-y|--yes]"
    echo "Example: $0 0.3.0"
    echo "Example: $0 0.3.0 -y  (skip confirmation)"
    exit 1
fi

NEW_VERSION="$1"
SKIP_CONFIRM=false

# Check for -y or --yes flag
if [ $# -gt 1 ]; then
    if [ "$2" = "-y" ] || [ "$2" = "--yes" ]; then
        SKIP_CONFIRM=true
    fi
fi

# Validate version format (basic semver check)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
    echo -e "${RED}Error: Invalid version format${NC}"
    echo "Version must follow semver format: MAJOR.MINOR.PATCH (e.g., 1.2.3)"
    echo "Optional pre-release and build metadata are supported (e.g., 1.2.3-alpha.1+build.123)"
    exit 1
fi

BACKEND_FILE="$PROJECT_ROOT/backend/pyproject.toml"
FRONTEND_FILE="$PROJECT_ROOT/frontend/package.json"

# Check if files exist
if [ ! -f "$BACKEND_FILE" ]; then
    echo -e "${RED}Error: Backend pyproject.toml not found at $BACKEND_FILE${NC}"
    exit 1
fi

if [ ! -f "$FRONTEND_FILE" ]; then
    echo -e "${RED}Error: Frontend package.json not found at $FRONTEND_FILE${NC}"
    exit 1
fi

# Get current versions
CURRENT_BACKEND_VERSION=$(grep '^version = ' "$BACKEND_FILE" | sed 's/version = "\(.*\)"/\1/')
CURRENT_FRONTEND_VERSION=$(grep '"version":' "$FRONTEND_FILE" | head -1 | sed 's/.*"version": "\(.*\)".*/\1/')

echo -e "${YELLOW}Current versions:${NC}"
echo "  Backend:  $CURRENT_BACKEND_VERSION"
echo "  Frontend: $CURRENT_FRONTEND_VERSION"
echo ""
echo -e "${YELLOW}New version: ${GREEN}$NEW_VERSION${NC}"
echo ""

# Confirm with user (unless -y flag is used)
if [ "$SKIP_CONFIRM" = false ]; then
    read -p "Update both files to version $NEW_VERSION? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Cancelled${NC}"
        exit 0
    fi
fi

# Update backend/pyproject.toml
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS (BSD sed)
    sed -i '' "s/^version = \".*\"/version = \"$NEW_VERSION\"/" "$BACKEND_FILE"
else
    # Linux (GNU sed)
    sed -i "s/^version = \".*\"/version = \"$NEW_VERSION\"/" "$BACKEND_FILE"
fi

# Update frontend/package.json
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS (BSD sed)
    sed -i '' "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" "$FRONTEND_FILE"
else
    # Linux (GNU sed)
    sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" "$FRONTEND_FILE"
fi

echo -e "${GREEN}Successfully updated version to $NEW_VERSION${NC}"
echo ""
echo "Updated files:"
echo "  - backend/pyproject.toml"
echo "  - frontend/package.json"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Review the changes: git diff"
echo "  2. Commit the version bump: git commit -am 'chore: bump version to $NEW_VERSION'"
echo "  3. Tag the release: git tag -a v$NEW_VERSION -m 'Release v$NEW_VERSION'"
echo "  4. Push with tags: git push && git push --tags"
