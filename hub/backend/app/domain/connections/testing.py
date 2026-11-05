"""Connection testing shared by the test endpoints and the health poller.

One URL builder per `DatabaseType`, so a type added to the enum without a
builder fails the unit test instead of reaching users as "not implemented".
"""

import asyncio
from collections.abc import Callable
from urllib.parse import quote_plus

from app.domain.connections.models import DatabaseType


def _network_url(scheme: str) -> Callable[[str, int, str, str, str], str]:
    def build(host: str, port: int, database: str, username: str, password: str) -> str:
        user = quote_plus(username)
        secret = quote_plus(password)
        return f"{scheme}://{user}:{secret}@{host}:{port}/{database}"

    return build


def _sqlite_url(host: str, port: int, database: str, username: str, password: str) -> str:
    return f"sqlite://{database}"


URL_BUILDERS: dict[DatabaseType, Callable[[str, int, str, str, str], str]] = {
    DatabaseType.POSTGRESQL: _network_url("postgresql"),
    DatabaseType.MYSQL: _network_url("mysql"),
    DatabaseType.MSSQL: _network_url("mssql"),
    DatabaseType.SQLITE: _sqlite_url,
}


def build_database_url(
    db_type: str | DatabaseType,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
) -> str:
    """Build the connectorx URI for a database connection.

    Raises:
        ValueError: if ``db_type`` is not a supported `DatabaseType`.
    """
    return URL_BUILDERS[DatabaseType(db_type)](host, port, database, username, password)


def _redact(message: str, *secrets: str) -> str:
    for secret in secrets:
        if secret:
            message = message.replace(secret, "***")
    return message


async def check_database_connection(
    db_type: str | DatabaseType,
    host: str,
    port: int,
    database: str,
    username: str,
    password: str,
) -> tuple[bool, str]:
    """Run ``SELECT 1`` against the connection without blocking the event loop.

    Returns ``(success, message)``; credentials are redacted from messages.
    """
    try:
        url = build_database_url(db_type, host, port, database, username, password)
    except ValueError:
        return False, f"Unsupported database type: {db_type}"

    try:
        import polars as pl
    except ImportError as e:
        return False, f"Database driver not available: {e}"

    try:
        await asyncio.to_thread(
            pl.read_database_uri, query="SELECT 1", uri=url, engine="connectorx"
        )
    except ImportError as e:
        return False, f"Database driver not available: {e}"
    except Exception as e:
        return False, f"Connection failed: {_redact(str(e), password, username)}"
    return True, "Connection successful"
