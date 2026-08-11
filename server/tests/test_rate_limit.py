"""Tests for the server's rate-limiting wiring."""

from fastapi import FastAPI
from fastapi.testclient import TestClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address


def _build_app(limit: str) -> FastAPI:
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[limit],
        headers_enabled=True,
    )
    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    @app.post("/api/workflow/execute")
    async def execute() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/health")
    @limiter.exempt
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


def test_default_workflow_limit_returns_429_after_burst():
    app = _build_app("3/minute")
    client = TestClient(app)
    statuses = [client.post("/api/workflow/execute").status_code for _ in range(5)]
    assert statuses.count(429) >= 1
    assert any(s == 200 for s in statuses)


def test_health_is_exempt_even_when_default_limit_strict():
    app = _build_app("1/minute")
    client = TestClient(app)
    for _ in range(10):
        assert client.get("/api/health").status_code == 200


def test_module_limiter_disabled_by_default():
    """Importing the server's rate-limit module with the default config
    must yield a disabled limiter so test suites are unaffected."""
    from app.middleware.rate_limit import limiter

    assert limiter is not None
    assert limiter.enabled is False
