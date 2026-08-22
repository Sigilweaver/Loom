"""Rate-limiting helpers.

Wraps slowapi's ``Limiter`` with a couple of conveniences:

* Bypass paths (``/health``, ``/api/health``) never count against quota.
* Limits can be disabled wholesale via ``RATE_LIMIT_ENABLED=0`` which is
  the default in unit tests.
* A custom key function returns ``"disabled"`` when limiting is off so
  decorated routes still call cleanly.
"""

from __future__ import annotations

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

_BYPASS_PATHS: frozenset[str] = frozenset({"/health", "/api/health"})


# Per-route key-function assignment (wired via `@limiter.limit(..., key_func=)`):
#
#   _client_ip     - auth login/register (default). Deliberately IP-keyed so a
#                    logged-in-looking client can't escape credential-stuffing
#                    limits by presenting an identity.
#   _user_or_ip    - capability-token issuance and server registration.
#                    Authenticated user actions; keyed per user id (IP fallback)
#                    so NAT'd users don't share a bucket and an IP-cycling user
#                    can't escape one. Requires request.state.user_id, set by
#                    get_current_user / get_optional_user.
#   _server_token  - internal server-to-server authorize endpoint, keyed by the
#                    presenting server's bearer token.


def _client_ip(request: Request) -> str:
    return get_remote_address(request)


def _user_or_ip(request: Request) -> str:
    """Key on authenticated user-id when available, else client IP."""
    user_id = getattr(request.state, "user_id", None)
    if user_id:
        return f"user:{user_id}"
    return f"ip:{get_remote_address(request)}"


def _server_token(request: Request) -> str:
    """Key on the Authorization-bearer token presented by a server, else IP."""
    auth = request.headers.get("authorization") or ""
    if auth.lower().startswith("bearer "):
        return f"tok:{auth.split(' ', 1)[1][:32]}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(
    key_func=_client_ip,
    enabled=settings.rate_limit_enabled,
    default_limits=[],
    headers_enabled=True,
)


def is_bypass_path(path: str) -> bool:
    return path in _BYPASS_PATHS
