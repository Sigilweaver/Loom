"""API router - aggregates all route modules"""

from fastapi import APIRouter

from app.api.routes import auth, executions, health, schedules, servers, workflows

api_router = APIRouter()

# Health check (no auth required)
api_router.include_router(health.router, tags=["health"])

# Authentication
api_router.include_router(auth.router, tags=["auth"])

# Core resources
api_router.include_router(workflows.router, tags=["workflows"])
api_router.include_router(servers.router, tags=["servers"])
api_router.include_router(executions.router, tags=["executions"])
api_router.include_router(schedules.router, tags=["schedules"])
