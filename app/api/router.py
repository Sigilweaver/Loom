"""Main API router - aggregates all route modules"""

from fastapi import APIRouter

from app.api.routes import health, datasource

api_router = APIRouter()

# Include route modules
api_router.include_router(health.router)
api_router.include_router(datasource.router)

# Future route modules:
# api_router.include_router(workflow.router)
