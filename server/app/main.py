"""FastAPI application entry point"""

import json
import logging
import os
import secrets
import sys
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import to register all tool implementations
import app.domain.tools.register  # noqa: F401
from app import __version__
from app.api.exception_handlers import WORKFLOW_EXCEPTION_HANDLERS
from app.api.router import api_router
from app.api.routes.cache import run_startup_maintenance
from app.config import settings
from app.middleware.audit import AuditMiddleware
from app.middleware.auth import AuthMiddleware


class JsonFormatter(logging.Formatter):
    """JSON log formatter for production environments."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_obj)


def configure_logging() -> None:
    """Configure logging based on settings."""
    root_logger = logging.getLogger()
    root_logger.setLevel(settings.log_level.upper())

    # Clear existing handlers
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    if settings.log_format == "json":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
        )
    root_logger.addHandler(handler)


# Configure logging at module load
configure_logging()
logger = logging.getLogger(__name__)


def validate_auth_config() -> None:
    """Validate auth configuration at startup.

    - ``disabled``: log a prominent WARNING; server accepts all requests.
    - ``ephemeral``: if no session_token configured, auto-generate one and
      log it once so local launchers (Electron, dev) can pick it up via env.
    - ``static``: require a non-empty session_token; refuse to boot otherwise.
    - ``hub``: require hub_url; refuse to boot otherwise.

    Must run before AuthMiddleware is instantiated, because the middleware
    snapshots the token in its __init__.
    """
    mode = settings.auth_mode

    if mode == "disabled":
        logger.warning(
            "AUTH DISABLED: server accepts unauthenticated requests. "
            "Set AUTH_MODE=ephemeral|static|hub to require authentication."
        )
        return

    if mode == "ephemeral":
        if not settings.session_token:
            token = secrets.token_urlsafe(32)
            settings.session_token = token
            # Expose to subprocesses (e.g. workers) and to operators reading env.
            os.environ["SESSION_TOKEN"] = token
            logger.warning(
                "AUTH_MODE=ephemeral: generated session token (set SESSION_TOKEN "
                "explicitly to suppress this message): %s",
                token,
            )
        return

    if mode == "static":
        if not settings.session_token:
            logger.error(
                "AUTH_MODE=static requires SESSION_TOKEN to be set. Refusing to start."
            )
            raise SystemExit(2)
        return

    if mode == "hub":
        if not settings.hub_url:
            logger.error("AUTH_MODE=hub requires HUB_URL to be set. Refusing to start.")
            raise SystemExit(2)
        return

    logger.error("Unknown AUTH_MODE=%r. Refusing to start.", mode)
    raise SystemExit(2)


validate_auth_config()

from app.utils.security import validate_file_access_config  # noqa: E402

validate_file_access_config()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application lifespan events."""
    # Startup: Run cache maintenance (TTL cleanup and LRU eviction)
    try:
        result = run_startup_maintenance()
        if result["enabled"]:
            if result["ttl_deleted"] or result["lru_evicted"]:
                logger.info(
                    f"Cache maintenance: {result['ttl_deleted']} TTL deletions, "
                    f"{result['lru_evicted']} LRU evictions"
                )
    except Exception as e:
        logger.warning(f"Cache startup maintenance failed: {e}")

    # Startup: Start Hub heartbeat if in hub auth mode
    heartbeat_manager = None
    if settings.auth_mode == "hub" and settings.hub_url:
        from app.domain.hub.heartbeat import create_heartbeat_manager

        heartbeat_manager = create_heartbeat_manager(
            server_name=settings.server_name or None,
            endpoint_url=settings.public_endpoint_url or None,
        )
        if heartbeat_manager:
            await heartbeat_manager.start()

    yield

    # Shutdown: Stop Hub heartbeat
    if heartbeat_manager:
        await heartbeat_manager.stop()


# Create FastAPI application
# Note: Named 'application' to avoid shadowing the 'app' module import
application = FastAPI(
    title="Sigilweaver Loom Backend",
    description="Data transformation workflow execution engine",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Add authentication middleware
# Note: Added before CORS so it executes AFTER CORS in request flow
# (Starlette middleware executes in reverse order of registration)
# This allows CORS preflight OPTIONS requests to be handled properly
application.add_middleware(AuthMiddleware)

# Configure CORS middleware
# In development mode (bundled desktop app), allow all origins
# In production mode (external server), use strict origin list
if settings.cors_mode == "development":
    cors_origins = ["*"]  # Permissive for local development
else:
    cors_origins = settings.cors_origins  # Strict for server deployment

application.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add audit logging middleware
application.add_middleware(AuditMiddleware)

# Rate limiting - workflow routes only
from slowapi import _rate_limit_exceeded_handler  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402
from slowapi.middleware import SlowAPIMiddleware  # noqa: E402

from app.middleware.rate_limit import limiter as _rl  # noqa: E402

application.state.limiter = _rl
application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
for exception_type, handler in WORKFLOW_EXCEPTION_HANDLERS.items():
    application.add_exception_handler(exception_type, handler)
application.add_middleware(SlowAPIMiddleware)

# Include API routes
application.include_router(api_router, prefix="/api")


@application.get("/")
async def root() -> dict[str, str]:
    """Root endpoint - basic service information"""
    return {
        "message": "Sigilweaver Loom Backend API",
        "version": __version__,
        "docs": "/docs",
    }


# Export as 'app' for ASGI servers (uvicorn expects 'app:app')
app = application  # type: ignore[assignment]


if __name__ == "__main__":
    """Entry point for PyInstaller executable"""
    import atexit
    import os
    import sys

    import uvicorn

    # Fix for Windows: Ensure stdout/stderr exist (PyInstaller console=False sets them to None).
    # Use os.devnull so this is cross-platform and register an atexit hook to close the
    # handles on shutdown rather than leaking them for the process lifetime.
    if sys.stdout is None:
        _devnull_stdout = open(os.devnull, "w")
        atexit.register(_devnull_stdout.close)
        sys.stdout = _devnull_stdout
    if sys.stderr is None:
        _devnull_stderr = open(os.devnull, "w")
        atexit.register(_devnull_stderr.close)
        sys.stderr = _devnull_stderr

    # Run uvicorn server
    uvicorn.run(
        application,
        host="127.0.0.1",
        port=25811,
        log_level="info",
    )
