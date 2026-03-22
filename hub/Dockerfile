# syntax=docker/dockerfile:1.7
# =============================================================================
# Sigilweaver Loom Hub - Production Dockerfile
# =============================================================================
# Multi-stage build for minimal image size:
#   Stage 1: Build frontend (Node.js)
#   Stage 2: Build backend dependencies (Python/uv)
#   Stage 3: Production runtime
#
# Build with: docker build --build-arg VERSION=1.0.0 -t sigilweaver-loom-hub .
# =============================================================================

# Build arguments for versioning and traceability
ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF

# =============================================================================
# Stage 1: Build frontend
# =============================================================================
FROM node:20.18-slim AS frontend-builder

WORKDIR /build

# Copy frontend package files
COPY hub/frontend/package*.json ./

# Install dependencies with cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts

# Copy frontend source
COPY hub/frontend/ ./

# Build production bundle
RUN npm run build

# =============================================================================
# Stage 2: Build backend dependencies
# =============================================================================
FROM python:3.11.9-slim-bookworm AS backend-builder

WORKDIR /build

# Install uv for fast dependency resolution
COPY --link --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv

# Copy dependency files
COPY hub/backend/pyproject.toml hub/backend/uv.lock ./

# Create virtual environment and install dependencies with cache mount
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

# =============================================================================
# Stage 3: Production runtime
# =============================================================================
FROM python:3.11.9-slim-bookworm AS runtime

# Re-declare ARGs after FROM
ARG VERSION
ARG BUILD_DATE
ARG VCS_REF

# Labels for GitHub Container Registry (OCI standard)
LABEL org.opencontainers.image.source="https://github.com/Sigilweaver/Loom" \
    org.opencontainers.image.description="Sigilweaver Loom Hub - Multi-user workflow orchestration" \
    org.opencontainers.image.licenses="AGPL-3.0-only" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${VCS_REF}"

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Copy virtual environment from builder (--link for better layer caching)
COPY --link --from=backend-builder /build/.venv /app/.venv

# Copy backend application code (includes migrations in app/db/migrations/)
COPY --link hub/backend/app ./app
COPY --link hub/backend/alembic.ini ./

# Copy frontend build from frontend-builder
COPY --link --from=frontend-builder /build/dist ./static

# Copy entrypoint
COPY --link hub/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create data directories (writable paths for read-only root filesystem)
RUN mkdir -p /app/data/workflows /tmp \
    && chown -R appuser:appuser /app /tmp

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

# Use tini as init process for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
CMD ["serve"]
