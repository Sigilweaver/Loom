"""Tests for canonical connection URI construction."""

import pytest

from app.domain.connections.models import DatabaseType, ResolvedConnection
from app.domain.connections.uri import build_connection_uri


def connection(database_type: DatabaseType, database: str = "analytics") -> ResolvedConnection:
    return ResolvedConnection(
        id="connection-1",
        name="Analytics",
        type=database_type,
        host="db.internal",
        port=5432,
        database=database,
        username="user@example.com",
        password="spaces and/slashes",
    )


@pytest.mark.parametrize("database_type", [DatabaseType.POSTGRESQL, DatabaseType.MYSQL])
def test_network_uri_encodes_credentials(database_type: DatabaseType) -> None:
    uri = build_connection_uri(connection(database_type))
    assert uri.startswith(f"{database_type.value}://user%40example.com:")
    assert "spaces%20and%2Fslashes" in uri


def test_sqlite_uri_uses_canonical_path_form() -> None:
    uri = build_connection_uri(connection(DatabaseType.SQLITE, "/data/my db.sqlite"))
    assert uri == "sqlite:///data/my%20db.sqlite"


def test_mssql_uri_enables_tls_options() -> None:
    uri = build_connection_uri(connection(DatabaseType.MSSQL))
    assert uri.endswith("?encrypt=true&trust_server_certificate=true")
