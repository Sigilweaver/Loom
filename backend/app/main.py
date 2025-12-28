"""FastAPI application entry point for Sigilweaver Hub"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.config import settings
from app.domain.servers.health_poller import health_poller

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage application lifespan events."""
    logger.info("Sigilweaver Hub starting up...")

    # Start server health polling
    await health_poller.start()

    yield

    logger.info("Sigilweaver Hub shutting down...")

    # Stop health polling
    await health_poller.stop()


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
