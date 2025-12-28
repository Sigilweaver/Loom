"""FastAPI dependency injection for API routes."""

from app.api.dependencies.connections import get_connection_resolver

__all__ = ["get_connection_resolver"]
