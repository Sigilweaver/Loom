"""Canonical database connection URI construction."""

from urllib.parse import quote

from app.domain.connections.models import DatabaseType, ResolvedConnection


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
