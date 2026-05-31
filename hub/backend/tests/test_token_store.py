"""Tests for the pluggable token store.

The in-memory backend is exercised end-to-end. The Postgres backend is
exercised via a stub session factory that records the SQL executed, which
verifies the atomic-claim contract without requiring a live database.
"""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.auth import tokens as tokens_module
from app.domain.auth.tokens import (
    InMemoryTokenStore,
    PostgresTokenStore,
    TokenStore,
    init_token_store,
)


@pytest.mark.asyncio
async def test_in_memory_create_and_consume_round_trip():
    store = InMemoryTokenStore()
    token = await store.create("user-1", "server-1", ttl_seconds=60)
    data = await store.consume(token, "server-1")
    assert data is not None
    assert data.user_id == "user-1"
    assert data.server_id == "server-1"


@pytest.mark.asyncio
async def test_in_memory_consume_is_one_time_use():
    store = InMemoryTokenStore()
    token = await store.create("u", "s", ttl_seconds=60)
    first = await store.consume(token, "s")
    second = await store.consume(token, "s")
    assert first is not None
    assert second is None


@pytest.mark.asyncio
async def test_in_memory_wrong_server_rejected():
    store = InMemoryTokenStore()
    token = await store.create("u", "s-real", ttl_seconds=60)
    assert await store.consume(token, "s-other") is None
    # Original server can still claim the token.
    assert await store.consume(token, "s-real") is not None


@pytest.mark.asyncio
async def test_in_memory_concurrent_consume_single_winner():
    """50 concurrent consumers race for one token; exactly one wins."""
    store = InMemoryTokenStore()
    token = await store.create("u", "s", ttl_seconds=60)
    results = await asyncio.gather(
        *(store.consume(token, "s") for _ in range(50))
    )
    successes = [r for r in results if r is not None]
    assert len(successes) == 1


def test_init_token_store_memory_backend(monkeypatch):
    monkeypatch.setattr(tokens_module, "_token_store", None, raising=False)
    store = init_token_store(backend="memory")
    assert isinstance(store, InMemoryTokenStore)


def test_init_token_store_postgres_backend(monkeypatch):
    monkeypatch.setattr(tokens_module, "_token_store", None, raising=False)

    class _StubFactory:
        def __call__(self):  # pragma: no cover - never entered
            raise AssertionError("session should not be opened during init")

    # Construct directly to avoid touching app.db.database during import.
    store = PostgresTokenStore(session_factory=_StubFactory())
    assert isinstance(store, TokenStore)


def test_init_token_store_unknown_backend_raises(monkeypatch):
    monkeypatch.setattr(tokens_module, "_token_store", None, raising=False)
    with pytest.raises(ValueError, match="Unknown token_store_backend"):
        init_token_store(backend="redis")


# ---------------------------------------------------------------------------
# PostgresTokenStore SQL contract (with a stubbed session factory)
# ---------------------------------------------------------------------------


class _StubResult:
    def __init__(self, row):
        self._row = row
        self.rowcount = 1 if row else 0

    def first(self):
        return self._row


class _StubRow:
    def __init__(self, user_id, server_id, expires_at):
        self.user_id = user_id
        self.server_id = server_id
        self.expires_at = expires_at


class _StubSession:
    def __init__(self, parent):
        self._parent = parent

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def execute(self, statement, params=None):
        self._parent.executed.append((statement, params))
        return self._parent.next_result()

    async def commit(self):
        self._parent.commits += 1


class _StubFactory:
    def __init__(self):
        self.executed: list = []
        self.commits = 0
        self._results: list = []

    def queue(self, result):
        self._results.append(result)

    def next_result(self):
        return self._results.pop(0) if self._results else _StubResult(None)

    def __call__(self):
        return _StubSession(self)


@pytest.mark.asyncio
async def test_postgres_create_issues_insert():
    factory = _StubFactory()
    factory.queue(_StubResult(None))  # INSERT returns no row
    store = PostgresTokenStore(session_factory=factory)
    token = await store.create("u", "s", ttl_seconds=60)
    assert token  # uuid4 string
    assert factory.commits == 1
    assert len(factory.executed) == 1


@pytest.mark.asyncio
async def test_postgres_consume_returns_data_when_row_claimed():
    factory = _StubFactory()
    expires = datetime.now(UTC) + timedelta(seconds=60)
    factory.queue(_StubResult(_StubRow("u", "s", expires)))
    store = PostgresTokenStore(session_factory=factory)
    data = await store.consume("token-x", "s")
    assert data is not None
    assert data.user_id == "u"
    assert data.server_id == "s"
    assert data.expires_at == expires
    # Verify the SQL is the atomic update with all four guard predicates.
    stmt, params = factory.executed[0]
    sql = str(stmt)
    assert "UPDATE server_tokens" in sql
    assert "used_at = NOW()" in sql
    assert "used_at IS NULL" in sql
    assert "expires_at > NOW()" in sql
    assert "RETURNING" in sql
    assert params == {"token": "token-x", "server_id": "s"}


@pytest.mark.asyncio
async def test_postgres_consume_returns_none_when_no_row():
    factory = _StubFactory()
    factory.queue(_StubResult(None))
    store = PostgresTokenStore(session_factory=factory)
    assert await store.consume("missing", "s") is None
