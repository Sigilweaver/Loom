#!/bin/bash
# =============================================================================
# Sigilweaver Loom Server - Container Entrypoint
# =============================================================================
# Handles:
#   - Graceful shutdown with signal trapping
#   - Mode detection (Hub vs Standalone)
#   - Server launch
# =============================================================================

set -e

# =============================================================================
# Signal Handling for Graceful Shutdown
# =============================================================================

# Track child process PID
CHILD_PID=""

cleanup() {
    echo "Received shutdown signal, gracefully stopping..."
    if [ -n "$CHILD_PID" ]; then
        kill -TERM "$CHILD_PID" 2>/dev/null || true
        wait "$CHILD_PID" 2>/dev/null || true
    fi
    echo "Shutdown complete."
    exit 0
}

# Trap SIGTERM and SIGINT for graceful shutdown
trap cleanup SIGTERM SIGINT

# =============================================================================
# Secret Loading from Docker Secrets
# =============================================================================
# Docker secrets are mounted as files at /run/secrets/<name>
# Environment variables ending in _FILE point to these files
# This function reads the file and exports the value to the base variable name

load_secret_from_file() {
    local var_name="$1"
    local file_var="${var_name}_FILE"
    local file_path="${!file_var}"
    
    # If file path is set and file exists, read it
    if [ -n "$file_path" ] && [ -f "$file_path" ]; then
        local value
        # Strip trailing newlines to avoid issues with cryptographic keys
        value="$(tr -d '\n' < "$file_path")"
        export "$var_name"="$value"
        echo "Loaded $var_name from secret file"
    fi
}

# Load secrets from Docker secret files (if mounted)
load_secret_from_file "HUB_REGISTRATION_SECRET"

# =============================================================================
# Startup Configuration
# =============================================================================

echo "=== Sigilweaver Loom Server Startup ==="
echo "Version: $(python -c 'from app import __version__; print(__version__)' 2>/dev/null || echo 'unknown')"

# Determine operating mode
if [ -n "$HUB_URL" ]; then
    echo "Mode: Hub-connected"
    echo "Hub URL: $HUB_URL"
    
    # Set auth mode to hub
    export AUTH_MODE="${AUTH_MODE:-hub}"
    
    if [ -z "$HUB_REGISTRATION_SECRET" ]; then
        echo "WARNING: HUB_REGISTRATION_SECRET not set - Hub may reject registration" >&2
    fi
else
    echo "Mode: Standalone"
    export AUTH_MODE="${AUTH_MODE:-disabled}"
fi

echo "Auth Mode: $AUTH_MODE"
echo "CORS Mode: ${CORS_MODE:-production}"

# =============================================================================
# Commands
# =============================================================================

case "${1:-serve}" in
    serve)
        echo "Starting Server on ${HOST:-0.0.0.0}:${PORT:-25811}..."
        python -m uvicorn app.main:application \
            --host "${HOST:-0.0.0.0}" \
            --port "${PORT:-25811}" \
            --log-level "${LOG_LEVEL:-info}" \
            --no-access-log &
        CHILD_PID=$!
        wait "$CHILD_PID" || true
        ;;
    shell)
        exec /bin/bash
        ;;
    *)
        exec "$@"
        ;;
esac
