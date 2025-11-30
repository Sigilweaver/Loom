"""FastAPI application entry point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.config import settings
from app.middleware.audit import AuditMiddleware

# Import to register all tool implementations
import app.domain.tools.register  # noqa: F401

# Create FastAPI application
app = FastAPI(
    title="SigilWeaver Backend",
    description="Data transformation workflow execution engine",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS middleware
# In development mode (bundled desktop app), allow all origins
# In production mode (external server), use strict origin list
if settings.cors_mode == "development":
    cors_origins = ["*"]  # Permissive for local development
else:
    cors_origins = settings.cors_origins  # Strict for server deployment

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add audit logging middleware
app.add_middleware(AuditMiddleware)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/")
async def root():
    """Root endpoint - basic service information"""
    return {
        "message": "SigilWeaver Backend API",
        "version": __version__,
        "docs": "/docs",
    }


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
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info",
    )
