"""Tests for the rate-limiting wiring.

These tests construct a self-contained FastAPI app that uses the same
slowapi machinery the real Hub configures, so behavior under load can be
verified without spinning up Postgres / sessions.
"""

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


# ---------------------------------------------------------------------------
# Identity-based key functions (per-user / per-server-token)
# ---------------------------------------------------------------------------


class _FakeRequest:
    """Minimal stand-in exposing what the key functions read."""

    def __init__(self, user_id=None, authorization=None, client_host="1.2.3.4"):
        from types import SimpleNamespace

        self.state = SimpleNamespace()
        if user_id is not None:
            self.state.user_id = user_id
        self.headers = {}
        if authorization is not None:
            self.headers["authorization"] = authorization
        self.client = SimpleNamespace(host=client_host)


def test_user_or_ip_keys_on_user_when_present():
    from app.middleware.rate_limit import _user_or_ip

    assert _user_or_ip(_FakeRequest(user_id="u-123")) == "user:u-123"


def test_user_or_ip_falls_back_to_ip_when_anonymous():
    from app.middleware.rate_limit import _user_or_ip

    key = _user_or_ip(_FakeRequest(client_host="9.9.9.9"))
    assert key == "ip:9.9.9.9"


def test_server_token_keys_on_bearer_token():
    from app.middleware.rate_limit import _server_token

    key = _server_token(_FakeRequest(authorization="Bearer abc123token"))
    assert key == "tok:abc123token"


def test_server_token_falls_back_to_ip_without_bearer():
    from app.middleware.rate_limit import _server_token

    key = _server_token(_FakeRequest(client_host="9.9.9.9"))
    assert key == "ip:9.9.9.9"


def _build_identity_app(limit: str, key_func) -> FastAPI:
    """Self-contained app that sets request.state.user_id from a header in a
    dependency, so the limiter's key function runs against real request state -
    the same ordering as the Hub (auth dependency resolves, then the limit is
    evaluated)."""
    from fastapi import Depends

    limiter = Limiter(key_func=key_func, default_limits=[], headers_enabled=True)
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    async def _set_identity(request: Request) -> None:
        uid = request.headers.get("x-test-user")
        if uid:
            request.state.user_id = uid

    @app.post("/limited")
    @limiter.limit(limit)
    async def limited(request: Request, _: None = Depends(_set_identity)) -> JSONResponse:
        return JSONResponse({"ok": True})

    return app


def test_user_keyed_route_separates_distinct_users_on_same_ip():
    """Two users behind the same IP get independent buckets; exhausting one
    must not throttle the other (the core defect in the issue)."""
    from app.middleware.rate_limit import _user_or_ip

    app = _build_identity_app("2/minute", _user_or_ip)
    client = TestClient(app)

    a = [client.post("/limited", headers={"x-test-user": "alice"}).status_code for _ in range(3)]
    assert a == [200, 200, 429]  # alice's bucket is exhausted

    # bob (same source IP, different identity) is unaffected.
    assert client.post("/limited", headers={"x-test-user": "bob"}).status_code == 200


def test_server_token_route_separates_distinct_tokens():
    from app.middleware.rate_limit import _server_token

    app = _build_identity_app("1/minute", _server_token)
    client = TestClient(app)

    assert client.post("/limited", headers={"authorization": "Bearer tok-A"}).status_code == 200
    assert client.post("/limited", headers={"authorization": "Bearer tok-A"}).status_code == 429
    # A different server token has its own bucket.
    assert client.post("/limited", headers={"authorization": "Bearer tok-B"}).status_code == 200
