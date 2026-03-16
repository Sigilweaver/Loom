"""
Connection-related dependencies for FastAPI routes.

Provides dependency injection for connection resolution in workflow execution.
"""

from app.domain.connections.resolver import ConnectionResolver, get_connection_resolver

__all__ = ["ConnectionResolver", "get_connection_resolver"]


# Re-export for convenience - routes can import from here
# The actual implementation is in app.domain.connections.resolver
