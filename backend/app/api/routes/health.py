"""Health check endpoints"""

import sys
import platform
from fastapi import APIRouter
from pydantic import BaseModel
import polars as pl

router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    """Health check response"""

    status: str
    version: str
    message: str
    python_version: str
    platform: str
    polars_version: str


@router.get("/", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """
    Health check endpoint
    
    Returns service status, version, and runtime environment information.
    Useful for debugging and verifying backend compatibility.
    """
    return HealthResponse(
        status="healthy",
        version="0.1.0",
        message="SigilWeaver Backend is running",
        python_version=f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        platform=f"{platform.system()} {platform.release()}",
        polars_version=pl.__version__
    )
