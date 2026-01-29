# =============================================================================
# Sigilweaver Server - Production Dockerfile
# =============================================================================
# Multi-stage build for minimal image size:
#   Stage 1: Build dependencies (Python/uv)
#   Stage 2: Production runtime
# =============================================================================

# =============================================================================
# Stage 1: Build dependencies
# =============================================================================
FROM python:3.11-slim-bookworm AS builder

WORKDIR /build

# Install build dependencies for compiled packages (connectorx, polars)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files
COPY server/pyproject.toml server/uv.lock ./

# Create virtual environment and install dependencies
RUN uv sync --frozen --no-dev --no-install-project

# =============================================================================
# Stage 2: Production runtime
# =============================================================================
FROM python:3.11-slim-bookworm AS runtime

# Labels for GitHub Container Registry
LABEL org.opencontainers.image.source="https://github.com/sigilweaver/sigilweaver"
LABEL org.opencontainers.image.description="Sigilweaver Server - Workflow execution engine"
LABEL org.opencontainers.image.licenses="Proprietary"

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /build/.venv /app/.venv

# Copy application code
COPY server/app ./app

# Copy entrypoint
COPY server/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Create data directory
RUN mkdir -p /app/data/files && chown -R appuser:appuser /app

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

ENTRYPOINT ["/entrypoint.sh"]
CMD ["serve"]
