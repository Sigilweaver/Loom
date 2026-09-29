"""Canonical database connection URI construction."""

from urllib.parse import quote, unquote

from app.domain.connections.models import DatabaseType, ResolvedConnection
from app.utils.security import validate_file_path

_SQLITE_SCHEME = "sqlite://"
_SQLITE_SCHEME_PREFIX = "sqlite:"


def is_sqlite_uri(uri: str) -> bool:
    """True when the URI names a SQLite database (scheme match is case-insensitive).

    Matches any ``sqlite:`` scheme, not only ``sqlite://``, so forms such as
    ``sqlite:/path/to.db`` cannot skip path validation.
    """
    return uri.strip().lower().startswith(_SQLITE_SCHEME_PREFIX)


def sqlite_path_from_uri(uri: str) -> str:
    """Extract the filesystem path a SQLite URI refers to.

    Strips the scheme, drops any ``?query`` or ``#fragment`` and percent-decodes
    the remainder exactly once (connectorx decodes the path the same way).
    """
    stripped = uri.strip()
    if stripped.lower().startswith(_SQLITE_SCHEME):
        rest = stripped[len(_SQLITE_SCHEME) :]
    else:
        rest = stripped[len(_SQLITE_SCHEME_PREFIX) :]
    rest = rest.split("?", 1)[0].split("#", 1)[0]
    return unquote(rest)


def guard_database_uri(uri: str) -> str:
    """Return a URI that is safe to hand to connectorx.

    Non-SQLite URIs are returned unchanged. SQLite URIs are parsed, validated
    against the file-access rules and rebuilt from the resolved path with no
    query string, so the file that was validated is the file that is opened.

    Raises:
        FileAccessDeniedError: If the path is outside the allowed paths.
        FileNotFoundAccessError: If the database file does not exist.
        FileAccessError: If the path is invalid or not a file.
    """
    if not is_sqlite_uri(uri):
        return uri
    resolved = validate_file_path(sqlite_path_from_uri(uri))
    return f"{_SQLITE_SCHEME}{quote(resolved.as_posix(), safe='/')}"


def build_connection_uri(connection: ResolvedConnection) -> str:
    """Build the ConnectorX URI used by every Server connection path."""
    database_type = (
        connection.type.value
        if isinstance(connection.type, DatabaseType)
        else str(connection.type)
    )

    if database_type == DatabaseType.SQLITE.value:
        encoded_path = quote(connection.database, safe="/")
        return f"sqlite://{encoded_path}"

    username = quote(connection.username, safe="")
    password = quote(connection.password, safe="")
    uri = (
        f"{database_type}://{username}:{password}@"
        f"{connection.host}:{connection.port}/{connection.database}"
    )

    if database_type == DatabaseType.MSSQL.value:
        uri += "?encrypt=true&trust_server_certificate=true"

    return uri
