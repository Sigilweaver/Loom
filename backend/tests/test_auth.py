"""Tests for authentication middleware"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.cors import CORSMiddleware

from app.middleware.auth import AuthMiddleware


class MockSettings:
    """Mock settings class for testing auth middleware."""

    def __init__(
        self,
        auth_mode: str = "disabled",
        session_token: str = "",
        auth_protect_docs: bool = True,
        auth_protect_health: bool = True,
    ):
        self.auth_mode = auth_mode
        self.session_token = session_token
        self.auth_protect_docs = auth_protect_docs
        self.auth_protect_health = auth_protect_health


def create_test_app(
    auth_mode: str = "disabled",
    session_token: str = "",
    auth_protect_docs: bool = True,
    auth_protect_health: bool = True,
) -> FastAPI:
    """Create a test FastAPI app with auth middleware configured."""
    mock_settings = MockSettings(
        auth_mode=auth_mode,
        session_token=session_token,
        auth_protect_docs=auth_protect_docs,
        auth_protect_health=auth_protect_health,
    )

    app = FastAPI()

    # Add routes for testing
    @app.get("/")
    def root():
        return {"message": "root"}

    @app.get("/api/health/")
    def health():
        return {"status": "healthy"}

    @app.get("/api/health")
    def health_no_slash():
        return {"status": "healthy"}

    @app.get("/docs")
    def docs():
        return {"message": "docs"}

    @app.get("/redoc")
    def redoc():
        return {"message": "redoc"}

    @app.get("/openapi.json")
    def openapi():
        return {"openapi": "3.0.0"}

    @app.get("/api/protected")
    def protected():
        return {"message": "protected resource"}

    @app.post("/api/workflow/execute")
    def execute():
        return {"message": "executed"}

    # Add auth middleware with injected settings
    app.add_middleware(AuthMiddleware, settings=mock_settings)

    return app


class TestAuthDisabledMode:
    """Tests for auth_mode='disabled'"""

    def test_all_requests_pass_through(self):
        """When auth is disabled, all requests should pass without token."""
        app = create_test_app(auth_mode="disabled")
        client = TestClient(app)

        # All endpoints should work without auth header
        assert client.get("/").status_code == 200
        assert client.get("/api/health/").status_code == 200
        assert client.get("/api/protected").status_code == 200
        assert client.post("/api/workflow/execute").status_code == 200

    def test_auth_header_ignored_when_disabled(self):
        """When auth is disabled, auth headers are ignored."""
        app = create_test_app(auth_mode="disabled")
        client = TestClient(app)

        # Should work with any token (or none)
        headers = {"Authorization": "Bearer invalid-token"}
        assert client.get("/api/protected", headers=headers).status_code == 200


class TestAuthEnabledMode:
    """Tests for auth_mode='ephemeral' or 'static' with valid token"""

    @pytest.mark.parametrize("auth_mode", ["ephemeral", "static"])
    def test_valid_token_accepted(self, auth_mode):
        """Valid Bearer token should be accepted."""
        token = "test-secret-token-12345"
        app = create_test_app(auth_mode=auth_mode, session_token=token)
        client = TestClient(app)

        headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/protected", headers=headers)
        assert response.status_code == 200
        assert response.json() == {"message": "protected resource"}

    @pytest.mark.parametrize("auth_mode", ["ephemeral", "static"])
    def test_missing_auth_header_rejected(self, auth_mode):
        """Request without Authorization header should be rejected."""
        token = "test-secret-token-12345"
        app = create_test_app(auth_mode=auth_mode, session_token=token)
        client = TestClient(app)

        response = client.get("/api/protected")
        assert response.status_code == 401
        assert response.json() == {"detail": "Authentication required"}

    @pytest.mark.parametrize("auth_mode", ["ephemeral", "static"])
    def test_invalid_token_rejected(self, auth_mode):
        """Invalid Bearer token should be rejected."""
        token = "test-secret-token-12345"
        app = create_test_app(auth_mode=auth_mode, session_token=token)
        client = TestClient(app)

        headers = {"Authorization": "Bearer wrong-token"}
        response = client.get("/api/protected", headers=headers)
        assert response.status_code == 401
        assert response.json() == {"detail": "Authentication required"}

    @pytest.mark.parametrize("auth_mode", ["ephemeral", "static"])
    def test_malformed_auth_header_rejected(self, auth_mode):
        """Malformed Authorization header should be rejected."""
        token = "test-secret-token-12345"
        app = create_test_app(auth_mode=auth_mode, session_token=token)
        client = TestClient(app)

        # Missing "Bearer" prefix
        headers = {"Authorization": token}
        response = client.get("/api/protected", headers=headers)
        assert response.status_code == 401

        # Wrong scheme
        headers = {"Authorization": f"Basic {token}"}
        response = client.get("/api/protected", headers=headers)
        assert response.status_code == 401

        # Empty header
        headers = {"Authorization": ""}
        response = client.get("/api/protected", headers=headers)
        assert response.status_code == 401

    @pytest.mark.parametrize("auth_mode", ["ephemeral", "static"])
    def test_bearer_case_insensitive(self, auth_mode):
        """Bearer scheme should be case-insensitive."""
        token = "test-secret-token-12345"
        app = create_test_app(auth_mode=auth_mode, session_token=token)
        client = TestClient(app)

        # Lowercase
        headers = {"Authorization": f"bearer {token}"}
        assert client.get("/api/protected", headers=headers).status_code == 200

        # Uppercase
        headers = {"Authorization": f"BEARER {token}"}
        assert client.get("/api/protected", headers=headers).status_code == 200

        # Mixed case
        headers = {"Authorization": f"BeArEr {token}"}
        assert client.get("/api/protected", headers=headers).status_code == 200


class TestEmptyTokenHandling:
    """Tests for empty token edge case (security vulnerability prevention)"""

    @pytest.mark.parametrize("auth_mode", ["ephemeral", "static"])
    def test_empty_token_disables_auth(self, auth_mode):
        """When session_token is empty, auth should be disabled even if mode is set."""
        # This is the critical security fix test
        app = create_test_app(auth_mode=auth_mode, session_token="")
        client = TestClient(app)

        # Should work without any token (auth effectively disabled)
        response = client.get("/api/protected")
        assert response.status_code == 200

    @pytest.mark.parametrize("auth_mode", ["ephemeral", "static"])
    def test_empty_token_logs_warning(self, auth_mode, caplog):
        """When token is empty but mode suggests auth, should log a warning."""
        import logging

        from starlette.applications import Starlette

        mock_settings = MockSettings(
            auth_mode=auth_mode,
            session_token="",
            auth_protect_docs=True,
            auth_protect_health=True,
        )

        # Capture log output using pytest's caplog fixture
        # Need to directly instantiate middleware to capture logs
        # (add_middleware delays instantiation until app starts)
        with caplog.at_level(logging.WARNING, logger="app.middleware.auth"):
            dummy_app = Starlette()
            middleware = AuthMiddleware(dummy_app, settings=mock_settings)

        # Verify warning was logged during middleware init
        assert len(caplog.records) == 1
        assert "no session_token configured" in caplog.records[0].message
        assert auth_mode in caplog.records[0].message

        # Also verify that auth is disabled as a result
        assert middleware.auth_enabled is False


class TestSkipPaths:
    """Tests for paths that bypass authentication"""

    def test_root_always_open(self):
        """Root path should always be accessible."""
        token = "test-token"
        app = create_test_app(auth_mode="ephemeral", session_token=token)
        client = TestClient(app)

        # Root should work without auth
        response = client.get("/")
        assert response.status_code == 200
        assert response.json() == {"message": "root"}

    def test_health_protected_by_default(self):
        """Health endpoint should require auth by default."""
        token = "test-token"
        app = create_test_app(
            auth_mode="ephemeral",
            session_token=token,
            auth_protect_health=True,
        )
        client = TestClient(app)

        # Without token
        assert client.get("/api/health/").status_code == 401

        # With valid token
        headers = {"Authorization": f"Bearer {token}"}
        assert client.get("/api/health/", headers=headers).status_code == 200

    def test_health_can_be_unprotected(self):
        """Health endpoint can be configured to skip auth."""
        token = "test-token"
        app = create_test_app(
            auth_mode="ephemeral",
            session_token=token,
            auth_protect_health=False,
        )
        client = TestClient(app)

        # Should work without token when protection is disabled
        assert client.get("/api/health/").status_code == 200
        assert client.get("/api/health").status_code == 200

    def test_docs_protected_by_default(self):
        """Doc endpoints should require auth by default."""
        token = "test-token"
        app = create_test_app(
            auth_mode="ephemeral",
            session_token=token,
            auth_protect_docs=True,
        )
        client = TestClient(app)

        # All doc endpoints should require auth
        assert client.get("/docs").status_code == 401
        assert client.get("/redoc").status_code == 401
        assert client.get("/openapi.json").status_code == 401

    def test_docs_can_be_unprotected(self):
        """Doc endpoints can be configured to skip auth."""
        token = "test-token"
        app = create_test_app(
            auth_mode="ephemeral",
            session_token=token,
            auth_protect_docs=False,
        )
        client = TestClient(app)

        # Should work without token when protection is disabled
        assert client.get("/docs").status_code == 200
        assert client.get("/redoc").status_code == 200
        assert client.get("/openapi.json").status_code == 200


class TestCORSPreflightOrdering:
    """
    Tests to verify CORS preflight (OPTIONS) requests are handled correctly.

    These tests verify that when CORSMiddleware is added after AuthMiddleware,
    the CORS middleware properly short-circuits OPTIONS preflight requests
    before they reach the auth middleware.
    """

    def test_cors_preflight_bypasses_auth(self):
        """OPTIONS preflight request should bypass auth when CORS middleware is outer."""
        token = "test-token"

        mock_settings = MockSettings(
            auth_mode="ephemeral",
            session_token=token,
            auth_protect_docs=True,
            auth_protect_health=True,
        )

        app = FastAPI()

        @app.get("/api/protected")
        def protected():
            return {"message": "protected"}

        # Add middlewares in the same order as main.py
        # AuthMiddleware first (inner), then CORS (outer)
        app.add_middleware(AuthMiddleware, settings=mock_settings)

        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:5173"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        client = TestClient(app)

        # Simulate CORS preflight request (OPTIONS with Origin and Access-Control-Request-Method)
        headers = {
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization",
        }
        response = client.options("/api/protected", headers=headers)

        # Should succeed (CORS middleware responds before auth middleware sees it)
        assert response.status_code == 200
        # Should have CORS headers
        assert "access-control-allow-origin" in response.headers


class TestTokenComparison:
    """Tests for secure token comparison"""

    def test_timing_safe_comparison(self):
        """Token comparison should use constant-time comparison."""
        # This is more of a documentation test - we trust secrets.compare_digest
        # but we verify the behavior is correct
        token = "correct-token"
        app = create_test_app(auth_mode="ephemeral", session_token=token)
        client = TestClient(app)

        # Correct token
        headers = {"Authorization": f"Bearer {token}"}
        assert client.get("/api/protected", headers=headers).status_code == 200

        # Slightly wrong token (same length)
        headers = {"Authorization": "Bearer correct-tokes"}
        assert client.get("/api/protected", headers=headers).status_code == 401

        # Very wrong token (different length)
        headers = {"Authorization": "Bearer x"}
        assert client.get("/api/protected", headers=headers).status_code == 401
