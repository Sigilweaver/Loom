#!/bin/bash
# =============================================================================
# Initialize Development Secrets
# =============================================================================
# Creates the .secrets directory with development-only placeholder values.
# These are NOT secure and should NEVER be used in production.
#
# Usage:
#   ./init-dev-secrets.sh
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SECRETS_DIR="$SCRIPT_DIR/.secrets"

echo "Creating development secrets in $SECRETS_DIR..."

# Create directory with restrictive permissions
mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

# Generate development secrets (these are NOT secure - for local dev only!)
echo -n "dev-session-secret-do-not-use-in-production-$(date +%s)" > "$SECRETS_DIR/session_secret"
echo -n "dev-secret-key-do-not-use-in-production-$(date +%s)" > "$SECRETS_DIR/secret_key"
echo -n "dev-registration-secret-$(date +%s)" > "$SECRETS_DIR/server_registration_secret"
echo -n "dev-password" > "$SECRETS_DIR/postgres_password"

# Generate a valid Fernet key for connection encryption
# Fernet requires exactly 32 bytes, url-safe base64 encoded
if command -v python3 &>/dev/null; then
    python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode(), end='')" > "$SECRETS_DIR/connection_encryption_key" 2>/dev/null || \
    head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '\n' > "$SECRETS_DIR/connection_encryption_key"
else
    # Generate 32 random bytes, url-safe base64 encoded (valid Fernet key format)
    head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '\n' > "$SECRETS_DIR/connection_encryption_key"
fi

# Set file permissions
chmod 600 "$SECRETS_DIR"/*

echo ""
echo "Development secrets created:"
ls -la "$SECRETS_DIR"
echo ""
echo "WARNING: These secrets are for LOCAL DEVELOPMENT ONLY."
echo "         Never use these values in production!"
echo ""
echo "You can now run: docker compose up"
