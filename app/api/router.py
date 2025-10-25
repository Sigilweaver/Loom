"""Main API router - aggregates all route modules"""

from fastapi import APIRouter

from app.api.routes import health

api_router = APIRouter()

# Include route modules
api_router.include_router(health.router)

# Future route modules:
# api_router.include_router(datasource.router)
# api_router.include_router(workflow.router)
