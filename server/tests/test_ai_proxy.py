"""Tests for the AI proxy route (streaming and non-streaming).

Validates the reverse proxy behaviour including:
- Streaming SSE passthrough (chunked / text/event-stream)
- Non-streaming (buffered) JSON responses
- Provider URL resolution and base_url normalization
- Error handling (connection refused, timeouts, generic exceptions)
- Hop-by-hop header stripping
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


# ---------------------------------------------------------------------------
# Helpers — build mock httpx responses
# ---------------------------------------------------------------------------


def _mock_response(
    *,
    status_code: int = 200,
    headers: dict[str, str] | None = None,
    content: bytes = b'{"ok":true}',
    chunks: list[bytes] | None = None,
) -> MagicMock:
    """Create a mock httpx.Response suitable for stream=True usage.

    If *chunks* is provided the response behaves as a streaming response;
    otherwise it returns *content* via ``aread()``.
    """
    resp = MagicMock()
    resp.status_code = status_code
    resp.headers = httpx.Headers(headers or {"content-type": "application/json"})

    # Non-streaming path
    resp.aread = AsyncMock(return_value=content)
    resp.aclose = AsyncMock()

    # Streaming path
    if chunks is not None:

        async def _aiter_bytes():
            for chunk in chunks:
                yield chunk

        resp.aiter_bytes = _aiter_bytes

    return resp


# ---------------------------------------------------------------------------
# Non-streaming proxy
# ---------------------------------------------------------------------------


class TestNonStreamingProxy:
    """Proxy should buffer the full response for non-streaming content types."""

    @patch("app.api.routes.ai.httpx.AsyncClient")
    def test_forwards_json_response(self, mock_client_cls, client):
        body = b'{"id":"msg_123","content":"Hello"}'
        mock_resp = _mock_response(content=body)
        mock_instance = MagicMock()
        mock_instance.build_request = MagicMock(return_value=MagicMock())
        mock_instance.send = AsyncMock(return_value=mock_resp)
        mock_instance.aclose = AsyncMock()
        mock_client_cls.return_value = mock_instance

        resp = client.post(
            "/api/ai/proxy/openai/v1/chat/completions",
            json={"model": "gpt-4", "messages": []},
        )

        assert resp.status_code == 200
        assert resp.json() == {"id": "msg_123", "content": "Hello"}
        mock_resp.aread.assert_awaited_once()
        mock_resp.aclose.assert_awaited_once()
        mock_instance.aclose.assert_awaited_once()

    @patch("app.api.routes.ai.httpx.AsyncClient")
    def test_strips_hop_by_hop_headers(self, mock_client_cls, client):
        mock_resp = _mock_response(
            headers={
                "content-type": "application/json",
                "connection": "keep-alive",
                "x-request-id": "abc123",
            },
        )
        mock_instance = MagicMock()
        mock_instance.build_request = MagicMock(return_value=MagicMock())
        mock_instance.send = AsyncMock(return_value=mock_resp)
        mock_instance.aclose = AsyncMock()
        mock_client_cls.return_value = mock_instance

        resp = client.post("/api/ai/proxy/openai/v1/chat/completions", json={})

        assert "connection" not in resp.headers
        assert resp.headers.get("x-request-id") == "abc123"


# ---------------------------------------------------------------------------
# Streaming proxy (SSE)
# ---------------------------------------------------------------------------


class TestStreamingProxy:
    """Proxy should forward SSE chunks as they arrive."""

    @patch("app.api.routes.ai.httpx.AsyncClient")
    def test_streams_sse_chunks(self, mock_client_cls, client):
        chunks = [
            b"data: {\"delta\":\"Hello\"}\n\n",
            b"data: {\"delta\":\" world\"}\n\n",
            b"data: [DONE]\n\n",
        ]
        mock_resp = _mock_response(
            headers={
                "content-type": "text/event-stream",
            },
            chunks=chunks,
        )
        mock_instance = MagicMock()
        mock_instance.build_request = MagicMock(return_value=MagicMock())
        mock_instance.send = AsyncMock(return_value=mock_resp)
        mock_instance.aclose = AsyncMock()
        mock_client_cls.return_value = mock_instance

        resp = client.post(
            "/api/ai/proxy/anthropic/v1/messages",
            json={"model": "claude-sonnet-4-20250514", "messages": []},
        )

        assert resp.status_code == 200
        # All chunks should be present in the response body
        body = resp.content
        assert b"Hello" in body
        assert b"world" in body
        assert b"[DONE]" in body

    @patch("app.api.routes.ai.httpx.AsyncClient")
    def test_streams_chunked_transfer(self, mock_client_cls, client):
        """Chunked transfer-encoding should also trigger streaming."""
        chunks = [b'{"chunk":1}', b'{"chunk":2}']
        mock_resp = _mock_response(
            headers={
                "content-type": "application/json",
                "transfer-encoding": "chunked",
            },
            chunks=chunks,
        )
        mock_instance = MagicMock()
        mock_instance.build_request = MagicMock(return_value=MagicMock())
        mock_instance.send = AsyncMock(return_value=mock_resp)
        mock_instance.aclose = AsyncMock()
        mock_client_cls.return_value = mock_instance

        resp = client.post(
            "/api/ai/proxy/openai/v1/chat/completions",
            json={},
        )

        body = resp.content
        assert b'{"chunk":1}' in body
        assert b'{"chunk":2}' in body


# ---------------------------------------------------------------------------
# Provider URL resolution
# ---------------------------------------------------------------------------


class TestProviderURLResolution:
    """Proxy should resolve the correct upstream URL for each provider."""

    @patch("app.api.routes.ai.httpx.AsyncClient")
    def test_openai_url(self, mock_client_cls, client):
        mock_resp = _mock_response()
        mock_instance = MagicMock()
        req = MagicMock()
        req.url = None
        mock_instance.build_request = MagicMock(return_value=req)
        mock_instance.send = AsyncMock(return_value=mock_resp)
        mock_instance.aclose = AsyncMock()
        mock_client_cls.return_value = mock_instance

        client.post("/api/ai/proxy/openai/v1/chat/completions", json={})

        call_kwargs = mock_instance.build_request.call_args
        assert "api.openai.com" in str(call_kwargs)

    @patch("app.api.routes.ai.httpx.AsyncClient")
    def test_unknown_provider_returns_400(self, mock_client_cls, client):
        resp = client.post("/api/ai/proxy/unknown_provider/v1/chat", json={})
        assert resp.status_code == 400
        assert "unknown_provider" in resp.json()["detail"].lower()

    @patch("app.api.routes.ai.httpx.AsyncClient")
    def test_openai_compatible_strips_trailing_slash(
        self, mock_client_cls, client
    ):
        """Server strips trailing slashes from base_url to avoid double-slash."""
        mock_resp = _mock_response()
        mock_instance = MagicMock()
        mock_instance.build_request = MagicMock(return_value=MagicMock())
        mock_instance.send = AsyncMock(return_value=mock_resp)
        mock_instance.aclose = AsyncMock()
        mock_client_cls.return_value = mock_instance

        client.post(
            "/api/ai/proxy/openai-compatible/v1/chat/completions"
            "?base_url=http://localhost:11434/",
            json={},
        )

        call_kwargs = mock_instance.build_request.call_args
        url = str(call_kwargs)
        # Trailing slash stripped — should NOT produce //v1
        assert "localhost:11434//v1" not in url
        assert "localhost:11434/v1" in url


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


class TestProxyErrorHandling:
    """Proxy should return appropriate HTTP errors on upstream failures."""

    @patch("app.api.routes.ai.httpx.AsyncClient")
    def test_connection_refused_returns_502(self, mock_client_cls, client):
        mock_instance = MagicMock()
        mock_instance.build_request = MagicMock(return_value=MagicMock())
        mock_instance.send = AsyncMock(
            side_effect=httpx.ConnectError("Connection refused")
        )
        mock_instance.aclose = AsyncMock()
        mock_client_cls.return_value = mock_instance

        resp = client.post(
            "/api/ai/proxy/openai/v1/chat/completions", json={}
        )

        assert resp.status_code == 502
        assert "connect" in resp.json()["detail"].lower()
        mock_instance.aclose.assert_awaited_once()

    @patch("app.api.routes.ai.httpx.AsyncClient")
    def test_read_timeout_returns_504(self, mock_client_cls, client):
        mock_instance = MagicMock()
        mock_instance.build_request = MagicMock(return_value=MagicMock())
        mock_instance.send = AsyncMock(
            side_effect=httpx.ReadTimeout("Read timed out")
        )
        mock_instance.aclose = AsyncMock()
        mock_client_cls.return_value = mock_instance

        resp = client.post(
            "/api/ai/proxy/openai/v1/chat/completions", json={}
        )

        assert resp.status_code == 504
        assert "timeout" in resp.json()["detail"].lower()
        mock_instance.aclose.assert_awaited_once()

    @patch("app.api.routes.ai.httpx.AsyncClient")
    def test_generic_exception_returns_502(self, mock_client_cls, client):
        mock_instance = MagicMock()
        mock_instance.build_request = MagicMock(return_value=MagicMock())
        mock_instance.send = AsyncMock(
            side_effect=RuntimeError("Something broke")
        )
        mock_instance.aclose = AsyncMock()
        mock_client_cls.return_value = mock_instance

        resp = client.post(
            "/api/ai/proxy/anthropic/v1/messages", json={}
        )

        assert resp.status_code == 502
        assert "Something broke" in resp.json()["detail"]
        mock_instance.aclose.assert_awaited_once()
