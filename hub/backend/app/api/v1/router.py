"""API v1 router - aggregates all route modules"""

from fastapi import APIRouter

from app.api.v1.routes import (
    audit,
    auth,
    capabilities,
    connections,
    executions,
    # file_paths,  # Deprecated: Use connections with type=filesystem instead
    grant_groups,
    groups,
    health,
    internal,
    schedules,
    servers,
    users,
    workflows,
)

v1_router = APIRouter()

# Health check (no auth required)
v1_router.include_router(health.router, tags=["health"])

# Authentication
v1_router.include_router(auth.router, tags=["auth"])

# User management
v1_router.include_router(users.router, tags=["users"])

# Core resources
v1_router.include_router(workflows.router, tags=["workflows"])
v1_router.include_router(servers.router, tags=["servers"])
v1_router.include_router(executions.router, tags=["executions"])
v1_router.include_router(schedules.router, tags=["schedules"])

# Connection management (admin only)
v1_router.include_router(connections.router, tags=["connections"])

# Group management (admin only)
v1_router.include_router(groups.router, tags=["groups"])

# Grant group management (admin only)
v1_router.include_router(grant_groups.router, tags=["grant-groups"])

# File paths deprecated - use connections with type=filesystem
# v1_router.include_router(file_paths.router, tags=["file-paths"])

# Audit log (auditor and above)
v1_router.include_router(audit.router, tags=["audit"])

# Capability endpoints (user-facing)
v1_router.include_router(capabilities.router, tags=["capabilities"])

# Internal endpoints (server-facing)
v1_router.include_router(internal.router, tags=["internal"])
