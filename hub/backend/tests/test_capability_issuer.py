"""Test real issuer tokens, lifetime and workflow connection scope."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.config import settings
from app.db.models import Server
from app.domain.auth import tokens as tokens_module
from app.domain.auth.tokens import InMemoryTokenStore
from app.domain.capabilities import CapabilityIssuer
from app.domain.capabilities import issuer as issuer_module


async def test_issued_token_binds_user_server_and_configured_expiry(monkeypatch):
    store = InMemoryTokenStore()
    issuer = CapabilityIssuer(store, settings.model_copy(update={"server_token_ttl_seconds": 17}))
    server = Server(id=uuid4(), name="target", endpoint_url="http://target.invalid")
    now = datetime(2026, 9, 30, tzinfo=UTC)

    class Clock:
        @staticmethod
        def now(tz):
            return now

    monkeypatch.setattr(tokens_module, "datetime", Clock)
    live = await issuer.issue_token("first-user", server)
    expired = await issuer.issue_token("second-user", server)
    assert live.server_endpoint == server.endpoint_url
    assert live.expires_in == 17
    assert live.token != expired.token
    assert await store.consume(live.token, str(uuid4())) is None
    now += timedelta(seconds=16)
    principal = await store.consume(live.token, str(server.id))
    assert principal is not None
    assert principal.user_id == "first-user"
    assert principal.server_id == str(server.id)
    assert await store.consume(live.token, str(server.id)) is None
    now += timedelta(seconds=1)
    assert await store.consume(expired.token, str(server.id)) is None


async def test_token_storage_failure_does_not_return_capability():
    class UnavailableStore(InMemoryTokenStore):
        async def create(self, user_id, server_id, ttl_seconds=300):
            raise RuntimeError("token storage unavailable")

    store = UnavailableStore()
    issuer = CapabilityIssuer(store, settings)
    server = Server(id=uuid4(), name="target", endpoint_url="http://target.invalid")
    with pytest.raises(RuntimeError, match="token storage unavailable"):
        await issuer.issue_token("user", server)
    assert store.token_count == 0


def test_issuer_requires_initialization_and_returns_initialized_instance(monkeypatch):
    monkeypatch.setattr(issuer_module, "_issuer", None)
    with pytest.raises(RuntimeError, match="not initialized"):
        issuer_module.get_issuer()
    store = InMemoryTokenStore()
    issuer = issuer_module.init_issuer(store, settings)
    assert issuer_module.get_issuer() is issuer
    assert issuer.token_store is store


@pytest.mark.parametrize(
    "workflow,expected",
    [
        ({}, []),
        ({"tools": [{"type": "Input", "config": None}]}, []),
        (
            {
                "tools": [
                    {"type": "Input", "config": {"owner": "client", "connectionId": "private"}},
                    {"type": "Input", "config": {"connectionId": "private"}},
                    {"type": "Input", "config": {"owner": "hub"}},
                    {"type": "Input", "config": {"owner": "hub", "connectionId": "granted"}},
                    {"type": "Input", "config": {"owner": "hub", "connectionId": "granted"}},
                    {"type": "Output", "config": {"connection": {"owner": "hub", "id": "output"}}},
                    {"type": "Output", "config": {"connection": {"owner": "hub"}}},
                    {
                        "type": "Input",
                        "config": {"connection": {"owner": "client", "id": "private"}},
                    },
                    {"type": "Input", "config": {"connection": "local"}},
                ]
            },
            ["granted", "output"],
        ),
    ],
)
def test_connection_scope_excludes_local_and_deduplicates_hub_connections(workflow, expected):
    assert CapabilityIssuer.extract_hub_connections(workflow) == expected
