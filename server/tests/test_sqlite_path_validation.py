"""SQLite database URIs must obey the same file-access rules as file inputs."""

import sqlite3
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from urllib.parse import quote

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.domain.connections.models import CreateConnectionInput, DatabaseType
from app.domain.connections.store import get_connection_store, reset_connection_store
from app.domain.connections.uri import guard_database_uri, sqlite_path_from_uri
from app.domain.datasources.database import SQLiteDataSource
from app.domain.tools.loaders.database import DatabaseLoader
from app.main import app
from app.utils import security as sec
from app.utils.errors import (
    FileAccessDeniedError,
    FileAccessError,
    FileNotFoundAccessError,
)


def _make_db(path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE t (a INTEGER)")
    conn.execute("INSERT INTO t VALUES (1)")
    conn.commit()
    conn.close()
    return path


def _uri(path: Path | str, suffix: str = "") -> str:
    return f"sqlite://{quote(str(path), safe='/')}{suffix}"


@pytest.fixture
def allowed_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Restrict file access to tmp_path/ok via the server allowlist."""
    ok = tmp_path / "ok"
    ok.mkdir()
    monkeypatch.setattr(sec.settings, "file_access_mode", "allowlist", raising=False)
    monkeypatch.setattr(sec.settings, "allowed_file_paths", [str(ok)], raising=False)
    return ok


@pytest.fixture
def outside_db(tmp_path: Path) -> Path:
    return _make_db(tmp_path / "secret" / "secret.db")


class TestGuardDatabaseUri:
    def test_non_sqlite_uri_untouched(self, allowed_dir: Path) -> None:
        uri = "postgresql://u:p@localhost:5432/db"
        assert guard_database_uri(uri) == uri

    def test_parse_strips_query_and_decodes(self) -> None:
        assert sqlite_path_from_uri("sqlite:///a/b%20c.db?mode=ro") == "/a/b c.db"

    def test_allowed_path_works(self, allowed_dir: Path) -> None:
        db = _make_db(allowed_dir / "good.db")
        guarded = guard_database_uri(_uri(db))
        assert sqlite_path_from_uri(guarded) == str(db.resolve())

    def test_outside_allowlist_rejected(self, allowed_dir: Path, outside_db: Path) -> None:
        with pytest.raises(FileAccessDeniedError):
            guard_database_uri(_uri(outside_db))

    def test_single_slash_scheme_rejected(self, allowed_dir: Path, outside_db: Path) -> None:
        with pytest.raises(FileAccessDeniedError):
            guard_database_uri(f"sqlite:{outside_db.as_posix()}")

    def test_percent_encoded_traversal_rejected(
        self, allowed_dir: Path, outside_db: Path
    ) -> None:
        sneaky = f"sqlite://{allowed_dir}/%2e%2e/secret/secret.db"
        with pytest.raises(FileAccessDeniedError):
            guard_database_uri(sneaky)

    def test_mode_ro_suffix_creates_nothing(self, allowed_dir: Path) -> None:
        with pytest.raises(FileNotFoundAccessError):
            guard_database_uri(_uri(allowed_dir / "t.db", "?mode=ro"))
        assert list(allowed_dir.iterdir()) == []

    def test_query_suffix_dropped_from_guarded_uri(self, allowed_dir: Path) -> None:
        db = _make_db(allowed_dir / "good.db")
        guarded = guard_database_uri(_uri(db, "?mode=rwc"))
        assert "?" not in guarded

    def test_mode_ro_suffix_does_not_bypass_allowlist(
        self, allowed_dir: Path, outside_db: Path
    ) -> None:
        with pytest.raises(FileAccessDeniedError):
            guard_database_uri(_uri(outside_db, "?mode=ro"))

    def test_missing_file_not_found_and_not_created(self, allowed_dir: Path) -> None:
        missing = allowed_dir / "nope.db"
        with pytest.raises(FileNotFoundAccessError):
            guard_database_uri(_uri(missing))
        assert not missing.exists()

    def test_directory_rejected(self, allowed_dir: Path) -> None:
        with pytest.raises(FileAccessError):
            guard_database_uri(_uri(allowed_dir))

    def test_uppercase_scheme_still_guarded(self, allowed_dir: Path, outside_db: Path) -> None:
        with pytest.raises(FileAccessDeniedError):
            guard_database_uri(_uri(outside_db).replace("sqlite", "SQLITE", 1))

    def test_hub_grants_enforced(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(sec.settings, "file_access_mode", "hub", raising=False)
        monkeypatch.setattr(sec.settings, "auth_mode", "hub", raising=False)
        granted = _make_db(tmp_path / "granted" / "g.db")
        other = _make_db(tmp_path / "other" / "o.db")
        token = sec.allowed_paths_context.set(
            [sec.FilePathGrant(path=str(granted.parent), read_only=True)]
        )
        try:
            guard_database_uri(_uri(granted))
            with pytest.raises(FileAccessDeniedError):
                guard_database_uri(_uri(other))
        finally:
            sec.allowed_paths_context.reset(token)


class TestLoaderEntryPoint:
    async def test_allowed_path_loads(self, allowed_dir: Path) -> None:
        db = _make_db(allowed_dir / "good.db")
        lf = await DatabaseLoader("sqlite").load({"source": _uri(db), "query": "SELECT a FROM t"})
        assert lf.collect()["a"].to_list() == [1]

    async def test_outside_allowlist_rejected(self, allowed_dir: Path, outside_db: Path) -> None:
        with pytest.raises(FileAccessDeniedError):
            await DatabaseLoader("sqlite").load(
                {"source": _uri(outside_db), "query": "SELECT a FROM t"}
            )

    async def test_sqlite_uri_with_other_declared_type_rejected(
        self, allowed_dir: Path, outside_db: Path
    ) -> None:
        with pytest.raises(FileAccessDeniedError):
            await DatabaseLoader("postgresql").load(
                {"source": _uri(outside_db), "query": "SELECT a FROM t"}
            )

    async def test_missing_file_not_created(self, allowed_dir: Path) -> None:
        with pytest.raises(FileNotFoundAccessError):
            await DatabaseLoader("sqlite").load(
                {"source": _uri(allowed_dir / "t.db", "?mode=ro"), "query": "SELECT 1"}
            )
        assert list(allowed_dir.iterdir()) == []


class TestDatasourceEntryPoints:
    async def test_datasource_methods_reject_outside_path(
        self, allowed_dir: Path, outside_db: Path
    ) -> None:
        ds = SQLiteDataSource()
        uri = _uri(outside_db)
        with pytest.raises(FileAccessDeniedError):
            await ds.inspect(uri, {"query": "SELECT a FROM t"})
        with pytest.raises(FileAccessDeniedError):
            await ds.preview(uri, {"query": "SELECT a FROM t"})
        with pytest.raises(FileAccessDeniedError):
            await ds.list_schema(uri)

    def test_routes_reject_outside_path(
        self, client: TestClient, allowed_dir: Path, outside_db: Path
    ) -> None:
        body: dict[str, Any] = {
            "source": _uri(outside_db),
            "sourceType": "sqlite",
            "config": {"query": "SELECT a FROM t"},
        }
        inspect = client.post("/api/datasource/inspect", json=body)
        assert inspect.status_code == 403, inspect.text
        assert client.post("/api/datasource/preview", json=body).status_code == 403
        schema = client.post(
            "/api/datasource/schema",
            json={"source": _uri(outside_db), "sourceType": "sqlite"},
        )
        assert schema.status_code == 403

    def test_routes_missing_file_is_404_and_not_created(
        self, client: TestClient, allowed_dir: Path
    ) -> None:
        body: dict[str, Any] = {
            "source": _uri(allowed_dir / "t.db", "?mode=ro"),
            "sourceType": "sqlite",
            "config": {"query": "SELECT 1"},
        }
        assert client.post("/api/datasource/inspect", json=body).status_code == 404
        assert list(allowed_dir.iterdir()) == []

    def test_route_allowed_path_works(self, client: TestClient, allowed_dir: Path) -> None:
        db = _make_db(allowed_dir / "good.db")
        resp = client.post(
            "/api/datasource/preview",
            json={
                "source": _uri(db),
                "sourceType": "sqlite",
                "config": {"query": "SELECT a FROM t"},
            },
        )
        assert resp.status_code == 200
        assert resp.json()["data"] == [{"a": 1}]


class TestConnectionEntryPoints:
    @pytest.fixture
    def client_with_store(
        self, monkeypatch: pytest.MonkeyPatch, tmp_path: Path
    ) -> Iterator[TestClient]:
        reset_connection_store()
        monkeypatch.setattr(
            "app.config.settings.connection_encryption_key", Fernet.generate_key().decode()
        )
        monkeypatch.setattr(
            "app.config.settings.connection_store_path", str(tmp_path / "conns.json")
        )
        monkeypatch.setattr("app.config.settings.auth_mode", "disabled")
        yield TestClient(app)
        reset_connection_store()

    def _payload(self, database: Path) -> dict[str, Any]:
        return {
            "name": "sq",
            "type": "sqlite",
            "host": "localhost",
            "port": 1,
            "database": str(database),
            "username": "u",
            "password": "p",
        }

    def test_connection_test_rejects_outside_path(
        self, client_with_store: TestClient, allowed_dir: Path, outside_db: Path
    ) -> None:
        # Store the connection directly, as if it was created before the fix.
        conn = get_connection_store().create_connection(
            CreateConnectionInput(
                name="legacy",
                type=DatabaseType.SQLITE,
                host="localhost",
                port=1,
                database=str(outside_db),
                username="u",
                password="p",
            )
        )
        resp = client_with_store.post(f"/api/connections/{conn.id}/test")
        assert resp.status_code == 403

    def test_connection_test_allowed_path(
        self, client_with_store: TestClient, allowed_dir: Path
    ) -> None:
        db = _make_db(allowed_dir / "good.db")
        created = client_with_store.post("/api/connections/", json=self._payload(db))
        assert created.status_code == 201
        resp = client_with_store.post(f"/api/connections/{created.json()['id']}/test")
        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_create_rejects_outside_path(
        self, client_with_store: TestClient, allowed_dir: Path, outside_db: Path
    ) -> None:
        resp = client_with_store.post("/api/connections/", json=self._payload(outside_db))
        assert resp.status_code == 403

    def test_create_missing_file_is_404(
        self, client_with_store: TestClient, allowed_dir: Path
    ) -> None:
        missing = allowed_dir / "nope.db"
        resp = client_with_store.post("/api/connections/", json=self._payload(missing))
        assert resp.status_code == 404
        assert not missing.exists()

    def test_update_rejects_outside_path(
        self, client_with_store: TestClient, allowed_dir: Path, outside_db: Path
    ) -> None:
        db = _make_db(allowed_dir / "good.db")
        created = client_with_store.post("/api/connections/", json=self._payload(db))
        resp = client_with_store.put(
            f"/api/connections/{created.json()['id']}", json={"database": str(outside_db)}
        )
        assert resp.status_code == 403
