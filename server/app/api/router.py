"""Main API router"""

from fastapi import APIRouter

from app.api.routes import archive, cache, connections, datasource, health, polars, workflow

api_router = APIRouter()

# Include route modules
api_router.include_router(health.router)
api_router.include_router(datasource.router)
api_router.include_router(workflow.router)
api_router.include_router(archive.router)
api_router.include_router(cache.router)
api_router.include_router(polars.router)
api_router.include_router(connections.router)
