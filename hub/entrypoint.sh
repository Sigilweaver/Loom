#!/bin/bash
# =============================================================================
# Sigilweaver Hub - Container Entrypoint
# =============================================================================
# Handles:
#   - Graceful shutdown with signal trapping
#   - Startup validation (required secrets)
#   - Database migrations
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
load_secret_from_file "SESSION_SECRET"
load_secret_from_file "SECRET_KEY"
load_secret_from_file "CONNECTION_ENCRYPTION_KEY"
load_secret_from_file "SERVER_REGISTRATION_SECRET"
load_secret_from_file "POSTGRES_PASSWORD"

# =============================================================================
# Database URL Construction
# =============================================================================
# If DATABASE_URL contains an empty password (from compose substitution with secrets),
# reconstruct it using the loaded POSTGRES_PASSWORD

construct_database_url() {
    # Check if DATABASE_URL has empty password (pattern: user:@host)
    if [[ "$DATABASE_URL" =~ :\/\/([^:]+):@([^/]+) ]]; then
        local user="${BASH_REMATCH[1]}"
        local host_and_rest="${BASH_REMATCH[2]}"
        local scheme="${DATABASE_URL%%://*}"
        local db_path="${DATABASE_URL#*@*/}"
        
        if [ -n "$POSTGRES_PASSWORD" ]; then
            # URL-encode the password to handle special characters (@, :, /, %, etc.)
            # Use stdin to avoid shell injection with special characters like '''
            local encoded_password
            encoded_password=$(printf '%s' "$POSTGRES_PASSWORD" | python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.stdin.read(), safe=''))" 2>/dev/null || printf '%s' "$POSTGRES_PASSWORD")
            export DATABASE_URL="${scheme}://${user}:${encoded_password}@${host_and_rest}/${db_path}"
            echo "Constructed DATABASE_URL with password from secret"
        else
            echo "WARNING: DATABASE_URL has empty password and POSTGRES_PASSWORD not set" >&2
        fi
    fi
}

construct_database_url

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
        python -m uvicorn app.main:application \
            --host "${HOST:-0.0.0.0}" \
            --port "${PORT:-25802}" \
            --log-level "${LOG_LEVEL:-info}" \
            --no-access-log &
        CHILD_PID=$!
        wait "$CHILD_PID" || true
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
