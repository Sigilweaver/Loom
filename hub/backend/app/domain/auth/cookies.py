"""Cookie sessions and CSRF protection for the Hub web app.

The Hub web app keeps its session in an ``HttpOnly`` cookie so that script
running in the page (including injected script) cannot read the session token.
API clients such as Studio keep using ``Authorization: Bearer <token>``; both
carry the same database-backed session token (see ``sessions.py``).

A cookie is sent by the browser automatically, so every state-changing request
authenticated by the cookie must also prove it came from the Hub web app: it
must carry ``X-CSRF-Token`` equal to the CSRF token for that session. The CSRF
token is an HMAC of the session token under ``SESSION_SECRET``, so it is bound
to the session and cannot be forged or planted by another site. The web app
reads it from a second, script-readable cookie. Bearer requests need no CSRF
token: browsers never attach an ``Authorization`` header on their own.

Both cookies are ``SameSite=Strict`` and, unless ``SESSION_COOKIE_SECURE`` is
turned off for plain-HTTP deployments, ``Secure``.
"""

import hashlib
import hmac

from fastapi import Request, Response

from app.config import settings

SESSION_COOKIE = "loom_hub_session"
CSRF_COOKIE = "loom_hub_csrf"
CSRF_HEADER = "X-CSRF-Token"

# The session cookie only needs to reach the API.
SESSION_COOKIE_PATH = "/api"
# The CSRF cookie must be readable by the web app on every page.
CSRF_COOKIE_PATH = "/"

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


def csrf_token_for(session_token: str) -> str:
    """Return the CSRF token bound to a session token."""
    if not settings.session_secret:
        # validate_required_secrets() refuses to start without it; never fall
        # back to an unkeyed hash.
        raise RuntimeError("SESSION_SECRET is not set")
    digest = hmac.new(
        settings.session_secret.encode(),
        b"loom-hub-csrf:" + session_token.encode(),
        hashlib.sha256,
    )
    return digest.hexdigest()


def csrf_is_valid(request: Request, session_token: str) -> bool:
    """Whether the request carries the CSRF token for this session."""
    presented = request.headers.get(CSRF_HEADER)
    if not presented:
        return False
    return hmac.compare_digest(presented, csrf_token_for(session_token))


def set_session_cookies(response: Response, session_token: str) -> None:
    """Attach the session and CSRF cookies to a response."""
    max_age = settings.session_lifetime_hours * 3600
    response.set_cookie(
        SESSION_COOKIE,
        session_token,
        max_age=max_age,
        path=SESSION_COOKIE_PATH,
        secure=settings.session_cookie_secure,
        httponly=True,
        samesite="strict",
    )
    response.set_cookie(
        CSRF_COOKIE,
        csrf_token_for(session_token),
        max_age=max_age,
        path=CSRF_COOKIE_PATH,
        secure=settings.session_cookie_secure,
        httponly=False,
        samesite="strict",
    )


def clear_session_cookies(response: Response) -> None:
    """Remove the session and CSRF cookies."""
    for name, path in ((SESSION_COOKIE, SESSION_COOKIE_PATH), (CSRF_COOKIE, CSRF_COOKIE_PATH)):
        response.delete_cookie(
            name,
            path=path,
            secure=settings.session_cookie_secure,
            httponly=name == SESSION_COOKIE,
            samesite="strict",
        )
