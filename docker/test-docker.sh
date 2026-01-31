#!/bin/bash
# =============================================================================
# Sigilweaver Docker Test Suite
# =============================================================================
# Comprehensive tests for Docker images and compose configuration.
#
# Usage:
#   ./test-docker.sh              # Run all tests
#   ./test-docker.sh --quick      # Quick validation only (no builds)
#   ./test-docker.sh --build      # Build and test images
#   ./test-docker.sh --security   # Security scanning only
#
# Prerequisites:
#   - Docker with BuildKit support
#   - hadolint (optional, for Dockerfile linting)
#   - docker scout, trivy, or grype (optional, for security scanning)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$ROOT_DIR/docker"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Options
QUICK_MODE=0
BUILD_MODE=0
SECURITY_MODE=0

# Cleanup trap for interrupted execution
cleanup_on_exit() {
    docker rm -f sigilweaver-test-server 2>/dev/null || true
}
trap cleanup_on_exit EXIT INT TERM

# =============================================================================
# Utilities
# =============================================================================

log_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[+]${NC} $1"
    ((TESTS_PASSED++)) || true
}

log_fail() {
    echo -e "${RED}[x]${NC} $1"
    ((TESTS_FAILED++)) || true
}

log_skip() {
    echo -e "${YELLOW}[-]${NC} $1 (skipped)"
    ((TESTS_SKIPPED++)) || true
}

log_header() {
    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
}

check_command() {
    if command -v "$1" &>/dev/null; then
        return 0
    else
        return 1
    fi
}

# =============================================================================
# Dockerfile Validation
# =============================================================================

test_dockerfile_syntax() {
    log_header "Dockerfile Syntax Validation"
    
    cd "$ROOT_DIR"  # Ensure we're in root for docker build context
    
    local dockerfiles=(
        "$ROOT_DIR/server/Dockerfile"
        "$ROOT_DIR/hub/Dockerfile"
    )
    
    for dockerfile in "${dockerfiles[@]}"; do
        local name=$(basename "$(dirname "$dockerfile")")
        
        # Check file exists
        if [ ! -f "$dockerfile" ]; then
            log_fail "$name/Dockerfile: File not found"
            continue
        fi
        
        # Validate with hadolint if available
        if check_command hadolint; then
            if hadolint --ignore DL3008 --ignore DL3013 "$dockerfile" 2>/dev/null; then
                log_success "$name/Dockerfile: hadolint passed"
            else
                log_fail "$name/Dockerfile: hadolint found issues"
                hadolint --ignore DL3008 --ignore DL3013 "$dockerfile" || true
            fi
        else
            # Basic validation: run docker build --check
            # Note: --check returns exit 1 even for warnings, so check output for actual errors
            local tmpfile
            tmpfile=$(mktemp)
            timeout 30 docker build --check -f "$dockerfile" "$ROOT_DIR" >"$tmpfile" 2>&1 || true
            
            if grep -E "^ERROR:|failed to build|failed to solve" "$tmpfile" >/dev/null 2>&1; then
                log_fail "$name/Dockerfile: build errors found"
                cat "$tmpfile"
            else
                log_success "$name/Dockerfile: syntax valid"
            fi
            rm -f "$tmpfile"
        fi
        
        # Check for required patterns
        if grep -q "^FROM.*AS.*builder\|^FROM.*AS.*build" "$dockerfile"; then
            log_success "$name/Dockerfile: multi-stage build detected"
        else
            log_fail "$name/Dockerfile: missing multi-stage build"
        fi
        
        if grep -q "^USER" "$dockerfile"; then
            log_success "$name/Dockerfile: non-root user configured"
        else
            log_fail "$name/Dockerfile: missing USER directive"
        fi
        
        if grep -q "^HEALTHCHECK" "$dockerfile"; then
            log_success "$name/Dockerfile: health check configured"
        else
            log_fail "$name/Dockerfile: missing HEALTHCHECK"
        fi
        
        if grep -q "tini" "$dockerfile"; then
            log_success "$name/Dockerfile: init process (tini) configured"
        else
            log_fail "$name/Dockerfile: missing init process"
        fi
        
        if grep -q -- "--mount=type=cache" "$dockerfile"; then
            log_success "$name/Dockerfile: BuildKit cache mounts configured"
        else
            log_fail "$name/Dockerfile: missing cache mounts"
        fi
    done
}

# =============================================================================
# Docker Compose Validation
# =============================================================================

test_compose_syntax() {
    log_header "Docker Compose Validation"
    
    cd "$DOCKER_DIR"
    
    # Validate main compose file
    if docker compose -f docker-compose.yml config --quiet 2>/dev/null; then
        log_success "docker-compose.yml: syntax valid"
    else
        log_fail "docker-compose.yml: syntax invalid"
        docker compose -f docker-compose.yml config 2>&1 | head -20
    fi
    
    # Validate override file
    if [ -f docker-compose.override.yml ]; then
        if docker compose -f docker-compose.yml -f docker-compose.override.yml config --quiet 2>/dev/null; then
            log_success "docker-compose.override.yml: syntax valid"
        else
            log_fail "docker-compose.override.yml: syntax invalid"
        fi
    else
        log_skip "docker-compose.override.yml not found"
    fi
    
    # Check for required services
    local config
    config=$(docker compose -f docker-compose.yml config 2>/dev/null)
    
    for service in postgres hub server; do
        if echo "$config" | grep -q "^  $service:"; then
            log_success "Service '$service' defined"
        else
            log_fail "Service '$service' missing"
        fi
    done
    
    # Check for security features
    if echo "$config" | grep -q "read_only: true"; then
        log_success "Read-only filesystems configured"
    else
        log_fail "Read-only filesystems not configured"
    fi
    
    if echo "$config" | grep -q "init: true"; then
        log_success "Init process configured in compose"
    else
        log_fail "Init process not configured in compose"
    fi
    
    if echo "$config" | grep -q "secrets:"; then
        log_success "Docker secrets configured"
    else
        log_fail "Docker secrets not configured"
    fi
    
    cd "$ROOT_DIR"
}

# =============================================================================
# Dockerignore Validation
# =============================================================================

test_dockerignore() {
    log_header "Dockerignore Validation"
    
    # Only check root .dockerignore since Docker builds use root context
    local ignorefiles=(
        "$ROOT_DIR/.dockerignore"
    )
    
    for ignorefile in "${ignorefiles[@]}"; do
        local name="${ignorefile#$ROOT_DIR/}"
        
        if [ -f "$ignorefile" ]; then
            log_success "$name exists"
            
            # Check for common exclusions
            if grep -q "node_modules" "$ignorefile"; then
                log_success "$name: excludes node_modules"
            fi
            
            if grep -q "__pycache__" "$ignorefile"; then
                log_success "$name: excludes __pycache__"
            fi
            
            if grep -q "\.env" "$ignorefile"; then
                log_success "$name: excludes .env files"
            fi
        else
            log_fail "$name not found"
        fi
    done
}

# =============================================================================
# Entrypoint Script Validation
# =============================================================================

test_entrypoints() {
    log_header "Entrypoint Script Validation"
    
    local entrypoints=(
        "$ROOT_DIR/server/entrypoint.sh"
        "$ROOT_DIR/hub/entrypoint.sh"
    )
    
    for entrypoint in "${entrypoints[@]}"; do
        local name=$(basename "$(dirname "$entrypoint")")/entrypoint.sh
        
        if [ ! -f "$entrypoint" ]; then
            log_fail "$name: file not found"
            continue
        fi
        
        # Check it's executable (in git)
        if [ -x "$entrypoint" ]; then
            log_success "$name: is executable"
        else
            log_fail "$name: not executable"
        fi
        
        # Check for shebang
        if head -1 "$entrypoint" | grep -q "^#!/bin/bash"; then
            log_success "$name: has bash shebang"
        else
            log_fail "$name: missing bash shebang"
        fi
        
        # Check for signal handling
        if grep -q "trap.*SIGTERM\|trap.*cleanup" "$entrypoint"; then
            log_success "$name: has signal handling"
        else
            log_fail "$name: missing signal handling"
        fi
        
        # Check for set -e
        if grep -q "^set -e" "$entrypoint"; then
            log_success "$name: has 'set -e' for error handling"
        else
            log_fail "$name: missing 'set -e'"
        fi
        
        # Syntax check with bash
        if bash -n "$entrypoint" 2>/dev/null; then
            log_success "$name: bash syntax valid"
        else
            log_fail "$name: bash syntax error"
            bash -n "$entrypoint"
        fi
    done
}

# =============================================================================
# Build Script Validation
# =============================================================================

test_build_script() {
    log_header "Build Script Validation"
    
    local build_script="$DOCKER_DIR/build.sh"
    
    if [ ! -f "$build_script" ]; then
        log_fail "build.sh not found"
        return
    fi
    
    # Syntax check
    if bash -n "$build_script" 2>/dev/null; then
        log_success "build.sh: bash syntax valid"
    else
        log_fail "build.sh: bash syntax error"
    fi
    
    # Check for BuildKit
    if grep -q "DOCKER_BUILDKIT=1" "$build_script"; then
        log_success "build.sh: BuildKit enabled"
    else
        log_fail "build.sh: BuildKit not enabled"
    fi
    
    # Check for version args
    if grep -q -- "--build-arg VERSION" "$build_script"; then
        log_success "build.sh: passes VERSION build arg"
    else
        log_fail "build.sh: missing VERSION build arg"
    fi
    
    # Check for security scanning
    if grep -q "scout\|trivy\|grype" "$build_script"; then
        log_success "build.sh: security scanning configured"
    else
        log_fail "build.sh: no security scanning"
    fi
}

# =============================================================================
# Image Build Tests
# =============================================================================

test_image_builds() {
    log_header "Image Build Tests"
    
    if [ "$BUILD_MODE" != "1" ] && [ "$QUICK_MODE" == "1" ]; then
        log_skip "Image builds (use --build to enable)"
        return
    fi
    
    cd "$ROOT_DIR"
    export DOCKER_BUILDKIT=1
    
    # Build server
    log_info "Building server image..."
    if docker build \
        --network=host \
        --build-arg VERSION=test \
        --build-arg BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --build-arg VCS_REF=test \
        -f server/Dockerfile \
        -t sigilweaver-server:test \
        . 2>&1 | tail -5; then
        log_success "Server image built successfully"
    else
        log_fail "Server image build failed"
        return
    fi
    
    # Build hub
    log_info "Building hub image..."
    if docker build \
        --network=host \
        --build-arg VERSION=test \
        --build-arg BUILD_DATE="$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
        --build-arg VCS_REF=test \
        -f hub/Dockerfile \
        -t sigilweaver-hub:test \
        . 2>&1 | tail -5; then
        log_success "Hub image built successfully"
    else
        log_fail "Hub image build failed"
        return
    fi
    
    # Verify image labels
    for image in sigilweaver-server:test sigilweaver-hub:test; do
        local version
        version=$(docker inspect --format='{{index .Config.Labels "org.opencontainers.image.version"}}' "$image" 2>/dev/null)
        if [ "$version" == "test" ]; then
            log_success "$image: version label set correctly"
        else
            log_fail "$image: version label not set (got: $version)"
        fi
    done
}

# =============================================================================
# Container Runtime Tests
# =============================================================================

test_container_runtime() {
    log_header "Container Runtime Tests"
    
    if [ "$BUILD_MODE" != "1" ] && [ "$QUICK_MODE" == "1" ]; then
        log_skip "Container runtime tests (use --build to enable)"
        return
    fi
    
    # Check if test images exist
    if ! docker image inspect sigilweaver-server:test &>/dev/null; then
        log_skip "Server test image not found (run with --build first)"
        return
    fi
    
    # Test server container starts
    log_info "Testing server container startup..."
    local container_id
    container_id=$(docker run -d --rm \
        --name sigilweaver-test-server \
        -e AUTH_MODE=disabled \
        sigilweaver-server:test 2>/dev/null) || true
    
    if [ -n "$container_id" ]; then
        sleep 3
        
        # Check if still running
        if docker ps --filter "id=$container_id" --format '{{.ID}}' | grep -q .; then
            log_success "Server container started and running"
            
            # Test graceful shutdown
            log_info "Testing graceful shutdown..."
            local start_time
            start_time=$(date +%s)
            docker stop --time=10 "$container_id" >/dev/null 2>&1
            local end_time
            end_time=$(date +%s)
            local shutdown_time=$((end_time - start_time))
            
            if [ "$shutdown_time" -lt 10 ]; then
                log_success "Graceful shutdown completed in ${shutdown_time}s"
            else
                log_fail "Shutdown took too long (${shutdown_time}s)"
            fi
        else
            log_fail "Server container stopped unexpectedly"
            docker logs sigilweaver-test-server 2>&1 | tail -10
        fi
        
        # Cleanup
        docker rm -f sigilweaver-test-server 2>/dev/null || true
    else
        log_fail "Failed to start server container"
    fi
    
    # Test read-only filesystem
    log_info "Testing read-only filesystem..."
    if docker run --rm --read-only \
        --tmpfs /tmp:mode=1777,size=10M \
        -e AUTH_MODE=disabled \
        sigilweaver-server:test \
        /bin/bash -c "touch /test-file 2>/dev/null && echo 'writable' || echo 'readonly'" 2>/dev/null | grep -q "readonly"; then
        log_success "Container works with read-only filesystem"
    else
        log_fail "Container failed with read-only filesystem"
    fi
}

# =============================================================================
# Security Scanning
# =============================================================================

test_security_scan() {
    log_header "Security Scanning"
    
    if [ "$SECURITY_MODE" != "1" ] && [ "$QUICK_MODE" == "1" ]; then
        log_skip "Security scanning (use --security to enable)"
        return
    fi
    
    # Check for test images
    if ! docker image inspect sigilweaver-server:test &>/dev/null; then
        log_skip "No test images to scan (run with --build first)"
        return
    fi
    
    local scanner=""
    if docker scout version &>/dev/null; then
        scanner="scout"
    elif check_command trivy; then
        scanner="trivy"
    elif check_command grype; then
        scanner="grype"
    fi
    
    if [ -z "$scanner" ]; then
        log_skip "No vulnerability scanner available (install docker scout, trivy, or grype)"
        return
    fi
    
    log_info "Using $scanner for vulnerability scanning..."
    
    for image in sigilweaver-server:test sigilweaver-hub:test; do
        if ! docker image inspect "$image" &>/dev/null; then
            log_skip "$image not found"
            continue
        fi
        
        local critical_count=0
        
        case "$scanner" in
            scout)
                critical_count=$(docker scout cves "$image" --only-severity critical 2>/dev/null | grep -c "critical" || echo "0")
                ;;
            trivy)
                critical_count=$(trivy image --severity CRITICAL --quiet "$image" 2>/dev/null | grep -c "CRITICAL" || echo "0")
                ;;
            grype)
                critical_count=$(grype "$image" --only-fixed --fail-on critical 2>/dev/null | grep -c "Critical" || echo "0")
                ;;
        esac
        
        if [ "$critical_count" -eq 0 ]; then
            log_success "$image: no critical vulnerabilities"
        else
            log_fail "$image: $critical_count critical vulnerabilities found"
        fi
    done
}

# =============================================================================
# Environment File Validation
# =============================================================================

test_env_files() {
    log_header "Environment File Validation"
    
    local env_example="$DOCKER_DIR/.env.example"
    
    if [ -f "$env_example" ]; then
        log_success ".env.example exists"
        
        # Check for required variables
        local required_vars=(
            "SESSION_SECRET"
            "SECRET_KEY"
            "CONNECTION_ENCRYPTION_KEY"
            "SERVER_REGISTRATION_SECRET"
            "POSTGRES_PASSWORD"
        )
        
        for var in "${required_vars[@]}"; do
            if grep -q "^$var=" "$env_example" || grep -q "^# $var=" "$env_example"; then
                log_success ".env.example: documents $var"
            else
                log_fail ".env.example: missing $var"
            fi
        done
    else
        log_fail ".env.example not found"
    fi
    
    # Check no actual secrets in repo (verify they're gitignored if they exist)
    if [ -f "$DOCKER_DIR/.env" ]; then
        if git check-ignore "$DOCKER_DIR/.env" >/dev/null 2>&1; then
            log_success ".env exists but is gitignored"
        else
            log_fail ".env file exists and is NOT gitignored"
        fi
    else
        log_success ".env not present"
    fi
    
    if [ -d "$DOCKER_DIR/.secrets" ]; then
        if git check-ignore "$DOCKER_DIR/.secrets" >/dev/null 2>&1; then
            log_success ".secrets exists but is gitignored"
        else
            log_fail ".secrets directory exists and is NOT gitignored"
        fi
    else
        log_success ".secrets not present"
    fi
}

# =============================================================================
# Main
# =============================================================================

print_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --quick      Quick validation only (no builds, no security scans)"
    echo "  --build      Build and test Docker images"
    echo "  --security   Run security scanning"
    echo "  --all        Run all tests including builds and security"
    echo "  -h, --help   Show this help message"
}

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --quick)
                QUICK_MODE=1
                shift
                ;;
            --build)
                BUILD_MODE=1
                shift
                ;;
            --security)
                SECURITY_MODE=1
                shift
                ;;
            --all)
                BUILD_MODE=1
                SECURITY_MODE=1
                shift
                ;;
            -h|--help)
                print_usage
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done
}

main() {
    parse_args "$@"
    
    echo -e "${BOLD}Sigilweaver Docker Test Suite${NC}"
    echo "=============================="
    
    # Quick validation tests (always run)
    test_dockerfile_syntax
    test_compose_syntax
    test_dockerignore
    test_entrypoints
    test_build_script
    test_env_files
    
    # Build tests (optional)
    test_image_builds
    test_container_runtime
    
    # Security tests (optional)
    test_security_scan
    
    # Summary
    log_header "Test Summary"
    echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
    echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
    echo -e "  ${YELLOW}Skipped:${NC} $TESTS_SKIPPED"
    echo ""
    
    if [ "$TESTS_FAILED" -gt 0 ]; then
        echo -e "${RED}${BOLD}Some tests failed!${NC}"
        exit 1
    else
        echo -e "${GREEN}${BOLD}All tests passed!${NC}"
        exit 0
    fi
}

main "$@"
