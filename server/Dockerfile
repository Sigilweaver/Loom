# syntax=docker/dockerfile:1.7
# =============================================================================
# Sigilweaver Server - Production Dockerfile
# =============================================================================
# Multi-stage build for minimal image size:
#   Stage 1: Build Python dependencies
#   Stage 2: Production runtime
#
# Build with: docker build --build-arg VERSION=1.0.0 -t sigilweaver-server .
# =============================================================================

# Build arguments for versioning and traceability
ARG VERSION=dev
ARG BUILD_DATE
ARG VCS_REF

# =============================================================================
# Stage 1: Build Python dependencies
# =============================================================================
FROM python:3.11.9-slim-bookworm AS builder

WORKDIR /build

# Install build dependencies for compiled packages (connectorx, polars)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution
COPY --link --from=ghcr.io/astral-sh/uv:0.5 /uv /usr/local/bin/uv

# Copy dependency files
COPY server/pyproject.toml server/uv.lock ./

# Install all dependencies (including sigilyx from PyPI) into a virtual environment.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv export --frozen --no-dev --no-emit-project \
    -o requirements.txt && \
    uv venv .venv && \
    uv pip install --python .venv/bin/python \
    -r requirements.txt

# =============================================================================
# Stage 2: Production runtime
# =============================================================================
FROM python:3.11.9-slim-bookworm AS runtime

# Re-declare ARGs after FROM
ARG VERSION
ARG BUILD_DATE
ARG VCS_REF

# Labels for GitHub Container Registry (OCI standard)
LABEL org.opencontainers.image.source="https://github.com/Sigilweaver/Sigilweaver" \
    org.opencontainers.image.description="Sigilweaver Server - Workflow execution engine" \
    org.opencontainers.image.licenses="AGPL-3.0-only" \
    org.opencontainers.image.version="${VERSION}" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${VCS_REF}"

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    tini \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Copy virtual environment from builder (--link for better layer caching)
COPY --link --from=builder /build/.venv /app/.venv

# Copy application code
COPY --link server/app ./app

# Copy entrypoint
COPY --link server/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create data directories (writable paths for read-only root filesystem)
RUN mkdir -p /app/data/files /app/data/cache /tmp \
    && chown -R appuser:appuser /app /tmp

# Switch to non-root user
USER appuser

# Environment defaults
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=25811 \
    LOG_LEVEL=info \
    LOG_FORMAT=json \
    CORS_MODE=production \
    AUTH_MODE=hub

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/api/health || exit 1

EXPOSE 25811

# Use tini as init process for proper signal handling
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
CMD ["serve"]
