"""Tests for the Server -> Hub client (registration and authorization).

The client is the trust boundary for Hub mode: whatever it returns decides which
files and database credentials a request may use. These tests drive it against an
in-process httpx transport so the request and response handling is exercised for
real, including malformed and failing Hub replies.
"""

import json
from collections.abc import Callable

import httpx
import pytest

from app.config import settings
from app.domain.hub import client as client_mod
from app.domain.hub.client import HubClient, get_hub_client

Handler = Callable[[httpx.Request], httpx.Response]


@pytest.fixture
def hub(monkeypatch):
    """Route every httpx.AsyncClient the hub client creates to a fake Hub handler."""
    state: dict[str, list[httpx.Request] | Handler] = {"requests": [], "handler": None}
    real_async_client = httpx.AsyncClient

    def _handler(request: httpx.Request) -> httpx.Response:
        requests = state["requests"]
        assert isinstance(requests, list)
        requests.append(request)
        handler = state["handler"]
        assert callable(handler), "test did not set a hub handler"
        return handler(request)

    def _factory(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(_handler)
        return real_async_client(*args, **kwargs)

    monkeypatch.setattr(client_mod.httpx, "AsyncClient", _factory)

    class Fake:
        def respond(self, handler: Handler) -> None:
            state["handler"] = handler

        def json(self, status: int, body: object) -> None:
            state["handler"] = lambda request: httpx.Response(status, json=body)

        @property
        def requests(self) -> list[httpx.Request]:
            requests = state["requests"]
            assert isinstance(requests, list)
            return requests

    return Fake()


@pytest.fixture
def hub_client() -> HubClient:
    return HubClient(hub_url="http://hub.test/", server_token="srv-token")


class TestConstruction:
    def test_trailing_slash_is_stripped(self, hub_client):
        assert hub_client.hub_url == "http://hub.test"

    def test_hub_url_required(self, monkeypatch):
        monkeypatch.setattr(settings, "hub_url", "")
        with pytest.raises(ValueError, match="hub_url"):
            HubClient(server_token="t")

    def test_server_token_required(self, monkeypatch):
        monkeypatch.setattr(settings, "hub_server_token", "")
        with pytest.raises(ValueError, match="hub_server_token"):
            HubClient(hub_url="http://hub.test")


class TestGetHubClient:
    def test_none_outside_hub_mode(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "disabled")
        assert get_hub_client() is None

    def test_none_when_hub_settings_missing(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(settings, "hub_url", "")
        monkeypatch.setattr(settings, "hub_server_token", "")
        assert get_hub_client() is None

    def test_client_in_hub_mode(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(settings, "hub_url", "http://hub.test")
        monkeypatch.setattr(settings, "hub_server_token", "srv")
        client = get_hub_client()
        assert client is not None
        assert client.hub_url == "http://hub.test"


class TestRegister:
    async def test_success_sends_token_and_secret(self, hub, hub_client):
        hub.json(201, {"id": "srv-1"})

        result = await hub_client.register(
            name="dev", endpoint_url="http://localhost:25811", registration_secret="s3cret"
        )

        assert result == {"id": "srv-1"}
        (request,) = hub.requests
        assert request.url == "http://hub.test/api/v1/servers"
        assert request.headers["X-Registration-Secret"] == "s3cret"
        assert json.loads(request.content) == {
            "name": "dev",
            "endpoint_url": "http://localhost:25811",
            "auth_token": "srv-token",
        }

    async def test_no_secret_header_when_not_configured(self, hub, hub_client):
        hub.json(200, {})
        await hub_client.register(name="dev", endpoint_url="http://x")
        assert "X-Registration-Secret" not in hub.requests[0].headers

    @pytest.mark.parametrize("status", [400, 401, 403, 409, 500, 503])
    async def test_error_status_returns_none(self, hub, hub_client, status):
        hub.json(status, {"detail": "nope"})
        assert await hub_client.register(name="dev", endpoint_url="http://x") is None

    @pytest.mark.parametrize(
        "error",
        [
            httpx.ConnectError("refused"),
            httpx.ReadTimeout("slow"),
            httpx.RemoteProtocolError("hub restarting"),
            RuntimeError("boom"),
        ],
    )
    async def test_transport_failures_return_none(self, hub, hub_client, error):
        def _raise(request):
            raise error

        hub.respond(_raise)
        assert await hub_client.register(name="dev", endpoint_url="http://x") is None

    async def test_non_json_success_body_returns_none(self, hub, hub_client):
        hub.respond(lambda request: httpx.Response(200, text="<html>not json</html>"))
        assert await hub_client.register(name="dev", endpoint_url="http://x") is None


DB_CREDENTIALS = {
    "type": "database",
    "name": "Warehouse",
    "db_type": "postgresql",
    "host": "db.internal",
    "port": 5432,
    "database": "wh",
    "username": "svc",
    "password": "pw",
}


class TestAuthorize:
    async def test_request_shape_and_bearer_uses_server_token(self, hub, hub_client):
        hub.json(200, {"authorized": True})

        await hub_client.authorize(
            server_token="one-time",
            request_type="execute",
            connection_ids=["c1"],
            workflow={"tools": []},
        )

        (request,) = hub.requests
        assert request.url == "http://hub.test/api/v1/internal/authorize"
        # The Hub is authenticated with this server's token, never the user's.
        assert request.headers["Authorization"] == "Bearer srv-token"
        assert json.loads(request.content) == {
            "server_token": "one-time",
            "request_type": "execute",
            "workflow": {"tools": []},
            "path": None,
            "connection_ids": ["c1"],
        }

    async def test_authorized_with_grants_and_credentials(self, hub, hub_client):
        hub.json(
            200,
            {
                "authorized": True,
                "user_id": "u1",
                "request_type": "execute",
                "credentials": {"c1": DB_CREDENTIALS, "fs1": {"type": "filesystem"}},
                "file_paths": [
                    {"path": "/data/in", "read_only": True},
                    {"path": "/data/out", "read_only": False},
                    {"path": "/data/default"},
                ],
            },
        )

        result = await hub_client.authorize(server_token="t", request_type="execute")

        assert result.authorized is True
        assert result.user_id == "u1"
        assert result.request_type == "execute"
        assert result.connections is not None
        assert set(result.connections) == {
            "c1"
        }  # filesystem creds become file_paths, not connections
        conn = result.connections["c1"]
        assert (conn.host, conn.port, conn.database, conn.username) == (
            "db.internal",
            5432,
            "wh",
            "svc",
        )
        assert result.file_paths is not None
        assert [(g.path, g.read_only) for g in result.file_paths] == [
            ("/data/in", True),
            ("/data/out", False),
            # A grant that does not say otherwise is read-only (fail closed)
            ("/data/default", True),
        ]

    async def test_no_grants_yields_none_not_empty(self, hub, hub_client):
        hub.json(200, {"authorized": True, "credentials": {}, "file_paths": []})
        result = await hub_client.authorize(server_token="t", request_type="browse")
        assert result.authorized is True
        assert result.connections is None
        assert result.file_paths is None

    async def test_hub_says_not_authorized(self, hub, hub_client):
        hub.json(200, {"authorized": False, "error": "Token expired"})
        result = await hub_client.authorize(server_token="t", request_type="execute")
        assert result.authorized is False
        assert result.error == "Token expired"
        assert result.file_paths is None

    async def test_hub_denial_without_reason_has_default_message(self, hub, hub_client):
        hub.json(200, {"authorized": False})
        result = await hub_client.authorize(server_token="t", request_type="execute")
        assert result.authorized is False
        assert result.error

    @pytest.mark.parametrize("status", [401, 403, 404, 500])
    async def test_non_200_denies(self, hub, hub_client, status):
        hub.json(status, {"detail": "internal detail"})
        result = await hub_client.authorize(server_token="t", request_type="execute")
        assert result.authorized is False
        assert str(status) in (result.error or "")
        assert result.file_paths is None
        assert result.connections is None

    async def test_timeout_denies(self, hub, hub_client):
        def _raise(request):
            raise httpx.ReadTimeout("slow")

        hub.respond(_raise)
        result = await hub_client.authorize(server_token="t", request_type="execute")
        assert result.authorized is False
        assert "timed out" in (result.error or "")

    async def test_unreachable_hub_denies(self, hub, hub_client):
        def _raise(request):
            raise httpx.ConnectError("refused")

        hub.respond(_raise)
        result = await hub_client.authorize(server_token="t", request_type="execute")
        assert result.authorized is False
        assert "Cannot reach Hub" in (result.error or "")

    async def test_garbage_body_denies(self, hub, hub_client):
        hub.respond(lambda request: httpx.Response(200, text="not json at all"))
        result = await hub_client.authorize(server_token="t", request_type="execute")
        assert result.authorized is False

    async def test_malformed_credentials_deny_with_a_reason(self, hub, hub_client):
        incomplete = {k: v for k, v in DB_CREDENTIALS.items() if k != "password"}
        hub.json(200, {"authorized": True, "credentials": {"c1": incomplete}})

        result = await hub_client.authorize(server_token="t", request_type="execute")

        # Never "authorized with partial credentials"
        assert result.authorized is False
        assert "missing 'password'" in (result.error or "")
        assert result.connections is None

    async def test_malformed_grant_denies(self, hub, hub_client):
        hub.json(200, {"authorized": True, "file_paths": [{"read_only": False}]})
        result = await hub_client.authorize(server_token="t", request_type="execute")
        assert result.authorized is False
        assert result.file_paths is None
