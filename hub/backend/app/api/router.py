"""API router - aggregates all route modules"""

from fastapi import APIRouter

from app.api.routes import (
    auth,
    capabilities,
    connections,
    executions,
    groups,
    health,
    internal,
    schedules,
    servers,
    workflows,
)

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

# Connection management (admin only)
api_router.include_router(connections.router, tags=["connections"])

# Group management (admin only)
api_router.include_router(groups.router, tags=["groups"])

# Capability endpoints (user-facing)
api_router.include_router(capabilities.router, tags=["capabilities"])

# Internal endpoints (server-facing)
api_router.include_router(internal.router, tags=["internal"])
