"""Tests for the rate-limiting wiring.

These tests construct a self-contained FastAPI app that uses the same
slowapi machinery the real Hub configures, so behavior under load can be
verified without spinning up Postgres / sessions.
"""

import pytest
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address


def _build_app(limit: str) -> FastAPI:
    limiter = Limiter(
        key_func=get_remote_address, default_limits=[], headers_enabled=True
    )
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    @app.post("/limited")
    @limiter.limit(limit)
    async def limited(request: Request) -> JSONResponse:
        return JSONResponse({"ok": True})

    @app.get("/health")
    @limiter.exempt
    async def health() -> JSONResponse:
        return JSONResponse({"status": "ok"})

    return app


def test_burst_eventually_returns_429():
    app = _build_app("3/minute")
    client = TestClient(app)
    statuses = [client.post("/limited").status_code for _ in range(5)]
    # First three under the limit, then 429.
    assert statuses[:3] == [200, 200, 200]
    assert statuses[-1] == 429


def test_429_includes_retry_after_header():
    app = _build_app("1/minute")
    client = TestClient(app)
    assert client.post("/limited").status_code == 200
    resp = client.post("/limited")
    assert resp.status_code == 429
    # slowapi sets Retry-After (lower-case) on rate-limited responses.
    assert any(k.lower() == "retry-after" for k in resp.headers.keys())


def test_health_is_exempt():
    app = _build_app("1/minute")
    client = TestClient(app)
    # Many calls to the exempt path must never 429.
    for _ in range(10):
        assert client.get("/health").status_code == 200


def test_server_limiter_imports_with_setting_disabled():
    """Importing the Hub rate-limit module with the default config must
    yield a Limiter with rate limiting disabled."""
    from app.middleware.rate_limit import limiter

    assert limiter is not None
    assert limiter.enabled is False
