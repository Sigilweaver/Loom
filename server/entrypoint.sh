#!/bin/bash
# =============================================================================
# Sigilweaver Server - Container Entrypoint
# =============================================================================
# Handles:
#   - Mode detection (Hub vs Standalone)
#   - Server launch
# =============================================================================

set -e

# =============================================================================
# Startup Configuration
# =============================================================================

echo "=== Sigilweaver Server Startup ==="
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
        exec python -m uvicorn app.main:application \
            --host "${HOST:-0.0.0.0}" \
            --port "${PORT:-25811}" \
            --log-level "${LOG_LEVEL:-info}" \
            --no-access-log
        ;;
    shell)
        exec /bin/bash
        ;;
    *)
        exec "$@"
        ;;
esac
