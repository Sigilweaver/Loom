"""FastAPI application entry point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Import to register all tool implementations
import app.domain.tools.register  # noqa: F401
from app import __version__
from app.api.router import api_router
from app.config import settings
from app.middleware.audit import AuditMiddleware
from app.middleware.auth import AuthMiddleware

# Create FastAPI application
# Note: Named 'application' to avoid shadowing the 'app' module import
application = FastAPI(
    title="SigilWeaver Backend",
    description="Data transformation workflow execution engine",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
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

# Include API routes
application.include_router(api_router, prefix="/api")


@application.get("/")
async def root() -> dict[str, str]:
    """Root endpoint - basic service information"""
    return {
        "message": "SigilWeaver Backend API",
        "version": __version__,
        "docs": "/docs",
    }


# Export as 'app' for ASGI servers (uvicorn expects 'app:app')
app = application  # type: ignore[assignment]


if __name__ == "__main__":
    """Entry point for PyInstaller executable"""
    import sys

    import uvicorn

    # Fix for Windows: Ensure stdout/stderr exist (PyInstaller console=False sets them to None)
    if sys.stdout is None:
        sys.stdout = open('NUL', 'w')
    if sys.stderr is None:
        sys.stderr = open('NUL', 'w')

    # Run uvicorn server
    uvicorn.run(
        application,
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )
