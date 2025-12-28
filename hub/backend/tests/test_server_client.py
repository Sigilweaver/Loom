"""Tests for server client"""

import pytest

from app.domain.servers.client import HealthResponse, ServerClient, ServerError


class TestServerClient:
    """Test cases for ServerClient"""

    def test_init(self):
        """Client initializes with endpoint URL"""
        client = ServerClient("http://localhost:58000")
        assert client.endpoint_url == "http://localhost:58000"
        assert client.auth_token is None

    def test_init_with_trailing_slash(self):
        """Client strips trailing slash from URL"""
        client = ServerClient("http://localhost:58000/")
        assert client.endpoint_url == "http://localhost:58000"

    def test_init_with_auth_token(self):
        """Client stores auth token"""
        client = ServerClient("http://localhost:58000", "my-token")
        assert client.auth_token == "my-token"

    def test_get_headers_without_auth(self):
        """Headers without auth token"""
        client = ServerClient("http://localhost:58000")
        headers = client._get_headers()
        assert "Accept" in headers
        assert "Authorization" not in headers

    def test_get_headers_with_auth(self):
        """Headers include auth token when provided"""
        client = ServerClient("http://localhost:58000", "my-token")
        headers = client._get_headers()
        assert headers["Authorization"] == "Bearer my-token"


class TestHealthResponse:
    """Test cases for HealthResponse"""

    def test_health_response_minimal(self):
        """HealthResponse with minimal fields"""
        response = HealthResponse(status="ok")
        assert response.status == "ok"
        assert response.version is None

    def test_health_response_full(self):
        """HealthResponse with all fields"""
        response = HealthResponse(status="ok", version="1.0.0")
        assert response.status == "ok"
        assert response.version == "1.0.0"


class TestServerError:
    """Test cases for ServerError"""

    def test_server_error_message_only(self):
        """ServerError with message only"""
        error = ServerError(message="Connection refused")
        assert error.message == "Connection refused"
        assert error.status_code is None

    def test_server_error_with_status(self):
        """ServerError with status code"""
        error = ServerError(message="Not found", status_code=404)
        assert error.message == "Not found"
        assert error.status_code == 404
