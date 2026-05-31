"""FastAPI application entry point for Sigilweaver Loom Hub"""

import json
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError

from app import __version__
from app.api.v1.router import v1_router
from app.config import settings
from app.db.database import async_session_maker
from app.domain.auth.sessions import SessionManager
from app.domain.auth.tokens import init_token_store
from app.domain.capabilities import init_issuer
from app.domain.connections.health_poller import connection_health_poller
from app.domain.schedules.scheduler import get_scheduler
from app.domain.servers.health_poller import health_poller


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


# Required secrets that must be set (or auto-generated when
# ALLOW_INSECURE_DEFAULTS=1) before Hub can start.
_REQUIRED_SECRETS = (
    "session_secret",
    "secret_key",
    "connection_encryption_key",
    "server_registration_secret",
)


def validate_required_secrets() -> None:
    """Refuse to boot if required secrets are missing.

    The dev escape hatch (``ALLOW_INSECURE_DEFAULTS=1``) auto-generates
    ephemeral values and logs them once. Tokens/sessions issued with these
    values will not survive a restart.

    Must run before FastAPI/middleware import the values.
    """
    import os
    import secrets as _secrets

    missing = [name for name in _REQUIRED_SECRETS if not getattr(settings, name)]
    if not missing:
        return

    if settings.allow_insecure_defaults:
        for name in missing:
            if name == "connection_encryption_key":
                from cryptography.fernet import Fernet

                value = Fernet.generate_key().decode()
            else:
                value = _secrets.token_urlsafe(32)
            setattr(settings, name, value)
            os.environ[name.upper()] = value
            logger.warning(
                "ALLOW_INSECURE_DEFAULTS: generated ephemeral %s. "
                "Do not use this in production.",
                name.upper(),
            )
        return

    msg = (
        "FATAL: Hub refuses to start - the following secrets are unset: "
        f"{', '.join(s.upper() for s in missing)}. "
        "Generate each with: "
        "python3 -c \"import secrets; print(secrets.token_urlsafe(32))\". "
        "For local development you may set ALLOW_INSECURE_DEFAULTS=1 to "
        "auto-generate ephemeral values (NOT for production)."
    )
    logger.critical(msg)
    raise SystemExit(msg)


validate_required_secrets()


# Session cleanup interval (default 1 hour, configurable via settings)
SESSION_CLEANUP_INTERVAL = settings.session_cleanup_interval_seconds


async def _session_cleanup_loop() -> None:
    """Background task to periodically clean up expired sessions.

    Runs forever until cancelled; each pass deletes at most
    ``settings.session_cleanup_batch_size`` rows to keep the delete
    transaction short. If a pass removes a full batch, an immediate
    follow-up pass drains the remaining backlog before sleeping again.
    """
    import asyncio

    batch_size = settings.session_cleanup_batch_size
    while True:
        try:
            await asyncio.sleep(SESSION_CLEANUP_INTERVAL)
            while True:
                async with async_session_maker() as db:
                    manager = SessionManager(db)
                    deleted = await manager.cleanup_expired_sessions(
                        batch_size=batch_size
                    )
                if deleted > 0:
                    logger.info(f"Cleaned up {deleted} expired sessions")
                if deleted < batch_size:
                    break
        except asyncio.CancelledError:
            break
        except SQLAlchemyError:
            # Keep the cleanup loop alive across transient database failures;
            # the next pass retries after the normal interval.
            logger.exception("Session cleanup database error")


_INSECURE_DEFAULT = "CHANGE_ME_IN_PRODUCTION"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application lifespan events."""
    import asyncio

    logger.info("Sigilweaver Loom Hub starting up...")

    # Initialize server token infrastructure
    token_store = init_token_store()
    init_issuer(token_store, settings)
    await token_store.start()

    # Start server health polling
    await health_poller.start()

    # Start connection health polling
    await connection_health_poller.start()

    # Start workflow scheduler
    scheduler = get_scheduler()
    await scheduler.start()

    # Start session cleanup background task
    session_cleanup_task = asyncio.create_task(_session_cleanup_loop())

    yield

    logger.info("Sigilweaver Loom Hub shutting down...")

    # Stop session cleanup
    session_cleanup_task.cancel()
    try:
        await session_cleanup_task
    except asyncio.CancelledError:
        pass

    # Stop token store cleanup
    await token_store.stop()

    # Stop health polling
    await health_poller.stop()

    # Stop connection health polling
    await connection_health_poller.stop()

    # Stop scheduler
    await scheduler.stop()


application = FastAPI(
    title="Sigilweaver Loom Hub",
    description="Workflow management and server coordination for Sigilweaver Loom",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Configure CORS
application.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
from slowapi import _rate_limit_exceeded_handler  # noqa: E402
from slowapi.errors import RateLimitExceeded  # noqa: E402
from slowapi.middleware import SlowAPIMiddleware  # noqa: E402

from app.middleware.rate_limit import limiter  # noqa: E402

application.state.limiter = limiter
application.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
application.add_middleware(SlowAPIMiddleware)

# Include API v1 routes
application.include_router(v1_router, prefix="/api/v1")


# Mount static files for production (when frontend is bundled with backend)
_static_mounted = False
if settings.static_files_path:
    static_path = Path(settings.static_files_path)
    if static_path.exists() and static_path.is_dir():
        # Note: Mount at "/" must come after all API routes are registered
        application.mount("/", StaticFiles(directory=static_path, html=True), name="static")
        _static_mounted = True
        logger.info(f"Serving static files from {static_path}")
    else:
        logger.warning(f"Static files path does not exist: {static_path}")


# Only register root endpoint when not serving static files
if not _static_mounted:

    @application.get("/")
    async def root() -> dict[str, str]:
        """Root endpoint - basic service information"""
        return {
            "service": "Sigilweaver Loom Hub",
            "version": __version__,
            "docs": "/docs",
        }


# Export as 'app' for ASGI servers
app = application


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        log_level=settings.log_level,
    )
