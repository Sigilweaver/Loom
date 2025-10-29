"""Main API router"""

from fastapi import APIRouter

from app.api.routes import health, datasource, workflow

api_router = APIRouter()

# Include route modules
api_router.include_router(health.router)
api_router.include_router(datasource.router)
api_router.include_router(workflow.router)

# Future route modules:
# api_router.include_router(workflow.router)
