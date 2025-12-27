"""Health check endpoint"""

from fastapi import APIRouter

from app import __version__

router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint for load balancers and monitoring"""
    return {
        "status": "healthy",
        "version": __version__,
    }
