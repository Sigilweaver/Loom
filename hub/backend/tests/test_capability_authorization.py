"""Exercise capability trust boundaries through the real Hub HTTP routes.

Tokens use the actual issuer/store, connections use encrypted PostgreSQL
storage, and grants use the same membership joins as production.
"""

from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

import pytest
from sqlalchemy import delete, select

from app.api.v1.routes import internal
from app.db.models import (
    AuditEvent,
    GrantGroup,
    GrantGroupConnection,
    Group,
    UserGroup,
    UserGroupGrantGroup,
)
from app.domain.auth import tokens as tokens_module
from app.domain.connections.models import (
    CreateDatabaseConnectionInput,
    CreateFilesystemConnectionInput,
    DatabaseType,
)
from app.domain.connections.store import ConnectionStore
from tests import db_helpers
from tests.conftest import TestSessionLocal, create_user_direct, new_client


@pytest.fixture
async def capability_context(setup_database, token_issuer, monkeypatch):
    user, session = await create_user_direct("capability-user", "user")
    server = await db_helpers.make_server(auth_token="registered-server-secret")
    monkeypatch.setattr(internal, "get_token_store", lambda: token_issuer.token_store)
    return user, server, {"Authorization": f"Bearer {session}"}


async def issue(client, headers, server):
    response = await client.post(
        "/api/v1/capabilities/token", headers=headers, json={"server_id": str(server.id)}
    )
    assert response.status_code == 200, response.text
    return response.json()["token"]


async def authorize(client, token, operation="execute", connection_ids=(), secret=None):
    return await client.post(
        "/api/v1/internal/authorize",
        headers={"Authorization": f"Bearer {secret or 'registered-server-secret'}"},
        json={
            "server_token": token,
            "request_type": operation,
            "connection_ids": list(connection_ids),
        },
    )


async def make_connections():
    async with TestSessionLocal() as db:
        store = ConnectionStore(db)
        database = await store.create_connection(
            CreateDatabaseConnectionInput(
                type="database",
                name="Private database",
                db_type=DatabaseType.POSTGRESQL,
                host="db.invalid",
                port=5432,
                database="private",
                username="restricted-user",
                password="private-password",
                read_only=True,
            ),
            created_by="test",
        )
        filesystem = await store.create_connection(
            CreateFilesystemConnectionInput(
                type="filesystem",
                name="Granted directory",
                path="/allowed",
                read_only=True,
            ),
            created_by="test",
        )
        ungranted = await store.create_connection(
            CreateFilesystemConnectionInput(
                type="filesystem",
                name="Private directory",
                path="/private",
            ),
            created_by="test",
        )
    return database.id, filesystem.id, ungranted.id


async def grant(user_id, connection_ids):
    async with TestSessionLocal() as db:
        group = Group(name="Authorized users", created_by="test")
        bundle = GrantGroup(name="Allowed connections", created_by="test")
        db.add_all([group, bundle])
        await db.flush()
        db.add_all(
            [
                UserGroup(user_id=user_id, group_id=group.id),
                UserGroupGrantGroup(
                    user_group_id=group.id, grant_group_id=bundle.id, assigned_by="test"
                ),
                *(
                    GrantGroupConnection(
                        grant_group_id=bundle.id, connection_id=UUID(conn_id), assigned_by="test"
                    )
                    for conn_id in connection_ids
                ),
            ]
        )
        await db.commit()


@pytest.mark.parametrize("operation", ["execute", "preview", "browse"])
async def test_ungranted_connection_never_discloses_credentials(capability_context, operation):
    _, server, headers = capability_context
    database, _, _ = await make_connections()
    async with new_client() as client:
        token = await issue(client, headers, server)
        response = await authorize(client, token, operation, [database])
        assert response.status_code == 200
        body = response.json()
        assert body["authorized"] is False
        assert "Unauthorized connections" in body["error"]
        assert body["credentials"] == {}
        assert body["file_paths"] == []
        assert "private-password" not in response.text
        # Denied requests cannot replay their bearer with a smaller request.
        assert (await authorize(client, token)).json()["authorized"] is False


@pytest.mark.parametrize("operation", ["execute", "preview", "browse"])
async def test_granted_connections_and_file_paths_are_narrowed(capability_context, operation):
    user, server, headers = capability_context
    database, filesystem, _ = await make_connections()
    await grant(user.id, [database, filesystem])
    async with new_client() as client:
        token = await issue(client, headers, server)
        response = await authorize(client, token, operation, [database, filesystem])
        assert response.status_code == 200
        body = response.json()
        assert body["authorized"] is True
        assert body["user_id"] == str(user.id)
        assert set(body["credentials"]) == {database, filesystem}
        assert body["credentials"][database]["password"] == "private-password"
        assert body["credentials"][database]["read_only"] is True
        assert body["credentials"][filesystem]["path"] == "/allowed"
        assert body["credentials"][filesystem]["read_only"] is True
        assert body["file_paths"] == [{"path": "/allowed", "read_only": True}]
        assert (await authorize(client, token)).json()["authorized"] is False
    async with TestSessionLocal() as db:
        events = (await db.execute(select(AuditEvent))).scalars().all()
        event = next(event for event in events if event.event_type == f"authorize.{operation}")
        assert event.server_id == server.id
        assert "private-password" not in str(event.details)


async def test_mixed_granted_and_private_connections_fail_closed(capability_context):
    user, server, headers = capability_context
    database, filesystem, ungranted = await make_connections()
    await grant(user.id, [database, filesystem])
    async with new_client() as client:
        token = await issue(client, headers, server)
        body = (await authorize(client, token, connection_ids=[database, ungranted])).json()
    assert body["authorized"] is False
    assert body["credentials"] == {}
    assert body["file_paths"] == []


async def test_revoked_membership_is_checked_at_consumption(capability_context):
    user, server, headers = capability_context
    database, _, _ = await make_connections()
    await grant(user.id, [database])
    async with new_client() as client:
        token = await issue(client, headers, server)
        async with TestSessionLocal() as db:
            await db.execute(delete(UserGroup).where(UserGroup.user_id == user.id))
            await db.commit()
        body = (await authorize(client, token, connection_ids=[database])).json()
    assert body["authorized"] is False
    assert body["credentials"] == {}


async def test_wrong_registered_server_cannot_consume_token(capability_context):
    _, server, headers = capability_context
    await db_helpers.make_server(name="other", auth_token="other-server-secret")
    async with new_client() as client:
        token = await issue(client, headers, server)
        assert (await authorize(client, token, secret="other-server-secret")).json()[
            "authorized"
        ] is False
        assert (await authorize(client, token)).json()["authorized"] is True


@pytest.mark.parametrize("authorization", ["Basic invalid", "Bearer unknown-server"])
async def test_invalid_server_identity_cannot_consume_token(capability_context, authorization):
    _, server, headers = capability_context
    async with new_client() as client:
        token = await issue(client, headers, server)
        response = await client.post(
            "/api/v1/internal/authorize",
            headers={"Authorization": authorization},
            json={"server_token": token, "request_type": "execute"},
        )
        assert response.status_code == 401
        assert (await authorize(client, token)).json()["authorized"] is True


async def test_expired_token_cannot_authorize(capability_context, token_issuer, monkeypatch):
    _, server, headers = capability_context
    async with new_client() as client:
        token = await issue(client, headers, server)
        future = datetime.now(UTC) + timedelta(
            seconds=token_issuer.settings.server_token_ttl_seconds + 1
        )

        class FutureClock:
            @staticmethod
            def now(tz):
                return future

        monkeypatch.setattr(tokens_module, "datetime", FutureClock)
        body = (await authorize(client, token)).json()
    assert body["authorized"] is False
    assert body["credentials"] == {}


async def test_unknown_token_cannot_authorize(capability_context):
    async with new_client() as client:
        body = (await authorize(client, str(uuid4()))).json()
    assert body["authorized"] is False
    assert body["credentials"] == {}


async def test_token_issuance_storage_failure_has_no_success_audit(
    capability_context,
    token_issuer,
    monkeypatch,
):
    _, server, headers = capability_context

    async def unavailable(*args, **kwargs):
        raise RuntimeError("token storage unavailable")

    monkeypatch.setattr(token_issuer.token_store, "create", unavailable)
    async with new_client() as client:
        with pytest.raises(RuntimeError, match="token storage unavailable"):
            await client.post(
                "/api/v1/capabilities/token", headers=headers, json={"server_id": str(server.id)}
            )
    assert token_issuer.token_store.token_count == 0
    async with TestSessionLocal() as db:
        issued = await db.execute(
            select(AuditEvent).where(AuditEvent.event_type == "capability.token_issued")
        )
        assert issued.scalars().all() == []
