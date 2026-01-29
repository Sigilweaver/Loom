#!/bin/bash
# =============================================================================
# Sigilweaver Hub - Container Entrypoint
# =============================================================================
# Handles:
#   - Startup validation (required secrets)
#   - Database migrations
#   - Server launch
# =============================================================================

set -e

# =============================================================================
# Startup Validation
# =============================================================================

validate_required_env() {
    local var_name="$1"
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ]; then
        echo "ERROR: Required environment variable $var_name is not set" >&2
        exit 1
    fi
    
    # Check for insecure defaults
    if [ "$var_value" = "CHANGE_ME_IN_PRODUCTION" ]; then
        echo "ERROR: $var_name is set to insecure default value" >&2
        exit 1
    fi
}

echo "=== Sigilweaver Hub Startup ==="
echo "Version: $(python -c 'from app import __version__; print(__version__)' 2>/dev/null || echo 'unknown')"
echo "Validating configuration..."

# Required variables
validate_required_env "DATABASE_URL"
validate_required_env "SESSION_SECRET"
validate_required_env "SECRET_KEY"
validate_required_env "CONNECTION_ENCRYPTION_KEY"

# Warn if server registration is open
if [ -z "$SERVER_REGISTRATION_SECRET" ]; then
    echo "WARNING: SERVER_REGISTRATION_SECRET not set - server registration is open" >&2
fi

echo "Configuration validated."

# =============================================================================
# Database Migrations
# =============================================================================

run_migrations() {
    echo "Running database migrations..."
    
    # Wait for database to be ready (using asyncpg since that's what we have)
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if python -c "
import asyncio
import asyncpg
import os

async def check():
    url = os.environ.get('DATABASE_URL', '')
    # Convert SQLAlchemy URL to asyncpg format
    # postgresql+asyncpg://user:pass@host:port/db -> postgresql://user:pass@host:port/db
    url = url.replace('+asyncpg', '')
    conn = await asyncpg.connect(url)
    await conn.execute('SELECT 1')
    await conn.close()

asyncio.run(check())
" 2>/dev/null; then
            echo "Database connection successful."
            break
        fi
        
        echo "Waiting for database... (attempt $attempt/$max_attempts)"
        sleep 2
        attempt=$((attempt + 1))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        echo "ERROR: Could not connect to database after $max_attempts attempts" >&2
        exit 1
    fi
    
    # Run Alembic migrations (use python -m to avoid shebang path issues)
    python -m alembic upgrade head
    echo "Migrations complete."
}

# =============================================================================
# Commands
# =============================================================================

case "${1:-serve}" in
    serve)
        run_migrations
        echo "Starting Hub server on ${HOST:-0.0.0.0}:${PORT:-25802}..."
        exec python -m uvicorn app.main:application \
            --host "${HOST:-0.0.0.0}" \
            --port "${PORT:-25802}" \
            --log-level "${LOG_LEVEL:-info}" \
            --no-access-log
        ;;
    migrate)
        run_migrations
        ;;
    shell)
        exec /bin/bash
        ;;
    *)
        exec "$@"
        ;;
esac
