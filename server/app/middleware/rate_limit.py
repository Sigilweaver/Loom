"""Rate-limiting helpers for the server (WP-06).

Workflow endpoints are subject to a default per-key budget when
``RATE_LIMIT_ENABLED=1``. ``/health`` is decorated with ``limiter.exempt``
to keep liveness probes off the meter.
"""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings


def _session_or_ip(request: Request) -> str:
    """Key on the session token presented in Authorization, else client IP."""
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        return f"tok:{auth.split(' ', 1)[1][:32]}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(
    key_func=_session_or_ip,
    enabled=settings.rate_limit_enabled,
    default_limits=[settings.rate_limit_workflow] if settings.rate_limit_enabled else [],
    headers_enabled=True,
)

