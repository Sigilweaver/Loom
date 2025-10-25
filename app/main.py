"""FastAPI application entry point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.router import api_router
from app.config import settings

# Create FastAPI application
app = FastAPI(
    title="SigilWeaver Backend",
    description="Data transformation workflow execution engine",
    version=__version__,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
