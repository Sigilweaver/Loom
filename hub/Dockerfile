# =============================================================================
# Sigilweaver Hub - Production Dockerfile
# =============================================================================
# Multi-stage build for minimal image size:
#   Stage 1: Build frontend (Node.js)
#   Stage 2: Build backend dependencies (Python/uv)
#   Stage 3: Production runtime
# =============================================================================

# =============================================================================
# Stage 1: Build frontend
# =============================================================================
FROM node:20-slim AS frontend-builder

WORKDIR /build

# Copy frontend package files
COPY hub/frontend/package*.json ./

# Install dependencies
RUN npm ci --ignore-scripts

# Copy frontend source
COPY hub/frontend/ ./

# Build production bundle
RUN npm run build

# =============================================================================
# Stage 2: Build backend dependencies
# =============================================================================
FROM python:3.11-slim-bookworm AS backend-builder

WORKDIR /build

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY hub/backend/pyproject.toml hub/backend/uv.lock ./

# Create virtual environment and install dependencies
RUN uv sync --frozen --no-dev --no-install-project

# =============================================================================
# Stage 3: Production runtime
# =============================================================================
FROM python:3.11-slim-bookworm AS runtime

# Labels for GitHub Container Registry
LABEL org.opencontainers.image.source="https://github.com/sigilweaver/sigilweaver"
LABEL org.opencontainers.image.description="Sigilweaver Hub - Multi-user workflow orchestration"
LABEL org.opencontainers.image.licenses="Proprietary"

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Copy virtual environment from builder
COPY --from=backend-builder /build/.venv /app/.venv

# Copy backend application code (includes migrations in app/db/migrations/)
COPY hub/backend/app ./app
COPY hub/backend/alembic.ini ./

# Copy frontend build from frontend-builder
COPY --from=frontend-builder /build/dist ./static

# Copy entrypoint
COPY hub/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create data directory
RUN mkdir -p /app/data/workflows && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Environment defaults
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=25802 \
    LOG_LEVEL=info \
    LOG_FORMAT=json

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/v1/health || exit 1

EXPOSE 25802

ENTRYPOINT ["/entrypoint.sh"]
CMD ["serve"]
