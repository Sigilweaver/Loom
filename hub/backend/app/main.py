"""FastAPI application entry point for Sigilweaver Hub"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.config import settings
from app.db.database import async_session_maker
from app.domain.auth.keys import init_key_manager
from app.domain.auth.sessions import SessionManager
from app.domain.auth.tokens import init_token_tracker
from app.domain.capabilities import init_issuer
from app.domain.connections.health_poller import connection_health_poller
from app.domain.schedules.scheduler import get_scheduler
from app.domain.servers.health_poller import health_poller

logger = logging.getLogger(__name__)


# Session cleanup interval (1 hour)
SESSION_CLEANUP_INTERVAL = 3600


async def _session_cleanup_loop() -> None:
    """Background task to periodically clean up expired sessions."""
    import asyncio

    while True:
        try:
            await asyncio.sleep(SESSION_CLEANUP_INTERVAL)
            async with async_session_maker() as db:
                manager = SessionManager(db)
                deleted = await manager.cleanup_expired_sessions()
                if deleted > 0:
                    logger.info(f"Cleaned up {deleted} expired sessions")
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error(f"Session cleanup error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application lifespan events."""
    import asyncio

    logger.info("Sigilweaver Hub starting up...")

    # Initialize server token infrastructure
    key_manager = init_key_manager(settings.jwt_private_key or None)
    token_tracker = init_token_tracker()
    init_issuer(key_manager, settings)
    await token_tracker.start()

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

    logger.info("Sigilweaver Hub shutting down...")

    # Stop session cleanup
    session_cleanup_task.cancel()
    try:
        await session_cleanup_task
    except asyncio.CancelledError:
        pass

    # Stop token tracker cleanup
    await token_tracker.stop()

    # Stop health polling
    await health_poller.stop()

    # Stop connection health polling
    await connection_health_poller.stop()

    # Stop scheduler
    await scheduler.stop()


application = FastAPI(
    title="Sigilweaver Hub",
    description="Workflow management and server coordination for Sigilweaver",
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

# Include API routes
application.include_router(api_router, prefix="/api")


@application.get("/")
async def root() -> dict[str, str]:
    """Root endpoint - basic service information"""
    return {
        "service": "Sigilweaver Hub",
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
