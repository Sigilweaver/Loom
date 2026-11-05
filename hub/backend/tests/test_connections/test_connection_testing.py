"""Connection testing covers every supported database type."""

from unittest.mock import patch

import pytest

from app.domain.connections.models import DatabaseType
from app.domain.connections.testing import (
    URL_BUILDERS,
    build_database_url,
    check_database_connection,
)


def test_every_database_type_has_a_url_builder():
    assert set(URL_BUILDERS) == set(DatabaseType)


@pytest.mark.parametrize(
    ("db_type", "expected"),
    [
        ("postgresql", "postgresql://u%40x:p%2Fw@db:5432/app"),
        ("mysql", "mysql://u%40x:p%2Fw@db:5432/app"),
        ("mssql", "mssql://u%40x:p%2Fw@db:5432/app"),
        ("sqlite", "sqlite://app"),
    ],
)
def test_url_quotes_credentials(db_type: str, expected: str):
    assert build_database_url(db_type, "db", 5432, "app", "u@x", "p/w") == expected


def test_unknown_type_is_rejected():
    with pytest.raises(ValueError):
        build_database_url("oracle", "db", 1521, "app", "u", "p")


async def test_unknown_type_reports_unsupported():
    ok, message = await check_database_connection("oracle", "db", 1521, "app", "u", "p")
    assert not ok
    assert "Unsupported database type" in message


async def test_failure_message_redacts_credentials():
    def fail(**_: object) -> None:
        raise RuntimeError("auth failed for scott with tiger")

    with patch("polars.read_database_uri", side_effect=fail):
        ok, message = await check_database_connection(
            DatabaseType.POSTGRESQL, "db", 5432, "app", "scott", "tiger"
        )
    assert not ok
    assert "scott" not in message and "tiger" not in message


async def test_sqlite_round_trip(tmp_path):
    import sqlite3

    path = tmp_path / "t.db"
    sqlite3.connect(path).close()
    ok, message = await check_database_connection("sqlite", "", 0, str(path), "", "")
    assert ok, message
