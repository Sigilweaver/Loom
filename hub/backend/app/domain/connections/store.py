"""Encrypted connection store backed by PostgreSQL.

This module provides storage for Hub-managed connections (database, filesystem, etc.).
Database credentials are encrypted using Fernet (AES-128-CBC with HMAC) before
storage. The encryption key must be provided via environment variable.

The store dispatches create/update/resolve operations based on connection type.
"""

import json
import logging
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db.models import Connection, ConnectionDatabase, ConnectionFilesystem
from app.domain.connections.models import (
    ConnectionInfo,
    ConnectionType,
    CreateConnectionInput,
    CreateDatabaseConnectionInput,
    CreateFilesystemConnectionInput,
    DatabaseConfig,
    DatabaseType,
    FilesystemConfig,
    PathType,
    ResolvedDatabaseConnection,
    ResolvedFilesystemConnection,
    UpdateConnectionInput,
    UpdateDatabaseConnectionInput,
    UpdateFilesystemConnectionInput,
)

logger = logging.getLogger(__name__)


class ConnectionStoreError(Exception):
    """Base exception for connection store errors."""

    pass


class EncryptionKeyError(ConnectionStoreError):
    """Raised when encryption key is missing or invalid."""

    pass


class ConnectionNotFoundError(ConnectionStoreError):
    """Raised when a connection ID doesn't exist."""

    pass


class DuplicateConnectionError(ConnectionStoreError):
    """Raised when trying to create a connection with duplicate name."""

    pass


class ConnectionStore:
    """Encrypted credential store for Hub-managed database connections.

    Credentials are encrypted using Fernet (AES-128-CBC with HMAC).
    The encryption key must be provided via environment variable.

    All operations are async and use the provided database session.
    """

    def __init__(self, db: AsyncSession, encryption_key: str | None = None):
        """Initialize the connection store.

        Args:
            db: Async database session.
            encryption_key: Fernet key. Uses settings if None.

        Raises:
            EncryptionKeyError: If no valid encryption key is available.
        """
        self.db = db
        key = encryption_key or settings.connection_encryption_key

        if not key:
            raise EncryptionKeyError(
                "CONNECTION_ENCRYPTION_KEY not configured. "
                "Generate with: Fernet.generate_key().decode()"
            )

        try:
            self.fernet = Fernet(key.encode())
        except Exception as e:
            raise EncryptionKeyError(
                f"Invalid CONNECTION_ENCRYPTION_KEY format: {e}. "
                "Must be a valid Fernet key (32 url-safe base64-encoded bytes)."
            )

    def _encrypt_credentials(self, username: str, password: str) -> str:
        """Encrypt credentials for storage.

        Args:
            username: Database username.
            password: Database password.

        Returns:
            Base64-encoded encrypted JSON string.
        """
        creds = json.dumps({"username": username, "password": password})
        encrypted = self.fernet.encrypt(creds.encode())
        return encrypted.decode()

    def _decrypt_credentials(self, encrypted: str) -> tuple[str, str]:
        """Decrypt stored credentials.

        Args:
            encrypted: Base64-encoded encrypted JSON string.

        Returns:
            Tuple of (username, password).

        Raises:
            EncryptionKeyError: If decryption fails.
        """
        try:
            decrypted = self.fernet.decrypt(encrypted.encode())
            creds = json.loads(decrypted.decode())
            return creds["username"], creds["password"]
        except InvalidToken:
            raise EncryptionKeyError(
                "Failed to decrypt credentials. "
                "The encryption key may have changed since the connection was created."
            )

    def _model_to_info(self, conn: Connection) -> ConnectionInfo:
        """Convert database model to ConnectionInfo."""
        # Build type-specific configs
        database_config = None
        filesystem_config = None

        if conn.type == ConnectionType.DATABASE.value and conn.database_config:
            db_cfg = conn.database_config
            database_config = DatabaseConfig(
                db_type=DatabaseType(db_cfg.db_type),
                host=db_cfg.host,
                port=db_cfg.port,
                database=db_cfg.database,
            )
        elif conn.type == ConnectionType.FILESYSTEM.value and conn.filesystem_config:
            fs_cfg = conn.filesystem_config
            filesystem_config = FilesystemConfig(
                path=fs_cfg.path,
                path_type=PathType(fs_cfg.path_type),
            )

        return ConnectionInfo(
            id=str(conn.id),
            name=conn.name,
            type=ConnectionType(conn.type),
            description=conn.description,
            read_only=conn.read_only,
            status=conn.status,
            last_checked=conn.last_checked,
            last_healthy=conn.last_healthy,
            last_error=conn.last_error,
            created_by=conn.created_by,
            created_at=conn.created_at,
            updated_at=conn.updated_at,
            database_config=database_config,
            filesystem_config=filesystem_config,
        )

    async def list_connections(
        self,
        connection_type: ConnectionType | None = None,
    ) -> list[ConnectionInfo]:
        """List all connections (without credentials).

        Args:
            connection_type: Optional filter by connection type.

        Returns:
            List of ConnectionInfo objects.
        """
        query = select(Connection).options(
            selectinload(Connection.database_config),
            selectinload(Connection.filesystem_config),
        ).order_by(Connection.name)

        if connection_type:
            query = query.where(Connection.type == connection_type.value)

        result = await self.db.execute(query)
        connections = result.scalars().all()
        return [self._model_to_info(c) for c in connections]

    async def get_connection(self, connection_id: UUID | str) -> ConnectionInfo | None:
        """Get a connection by ID (without credentials).

        Args:
            connection_id: The connection UUID.

        Returns:
            ConnectionInfo if found, None otherwise.
        """
        if isinstance(connection_id, str):
            connection_id = UUID(connection_id)

        result = await self.db.execute(
            select(Connection)
            .options(
                selectinload(Connection.database_config),
                selectinload(Connection.filesystem_config),
            )
            .where(Connection.id == connection_id)
        )
        conn = result.scalar_one_or_none()

        if conn is None:
            return None

        return self._model_to_info(conn)

    async def create_connection(
        self,
        input: CreateConnectionInput,
        created_by: str,
    ) -> ConnectionInfo:
        """Create a new connection.

        Args:
            input: Connection details (type determines validation).
            created_by: Username of the creating user.

        Returns:
            The created ConnectionInfo.

        Raises:
            DuplicateConnectionError: If name already exists.
        """
        # Check for duplicate name
        result = await self.db.execute(select(Connection).where(Connection.name == input.name))
        if result.scalar_one_or_none():
            raise DuplicateConnectionError(f"Connection with name '{input.name}' already exists")

        # Create base connection
        conn = Connection(
            name=input.name,
            type=input.type,
            description=input.description,
            read_only=input.read_only,
            created_by=created_by,
        )

        # Add type-specific config
        if isinstance(input, CreateDatabaseConnectionInput):
            encrypted = self._encrypt_credentials(input.username, input.password)
            conn.database_config = ConnectionDatabase(
                db_type=input.db_type.value,
                host=input.host,
                port=input.port,
                database=input.database,
                encrypted_credentials=encrypted,
            )
        elif isinstance(input, CreateFilesystemConnectionInput):
            conn.filesystem_config = ConnectionFilesystem(
                path=input.path,
                path_type=input.path_type.value,
            )

        self.db.add(conn)
        await self.db.commit()
        await self.db.refresh(conn, ["database_config", "filesystem_config"])

        logger.info(f"Created {input.type} connection '{conn.name}' (id={conn.id}) by {created_by}")
        return self._model_to_info(conn)

    async def update_connection(
        self,
        connection_id: UUID | str,
        input: UpdateConnectionInput,
    ) -> ConnectionInfo:
        """Update an existing connection.

        Args:
            connection_id: The connection UUID.
            input: Fields to update (None fields are ignored).

        Returns:
            The updated ConnectionInfo.

        Raises:
            ConnectionNotFoundError: If connection doesn't exist.
            DuplicateConnectionError: If new name already exists.
        """
        if isinstance(connection_id, str):
            connection_id = UUID(connection_id)

        result = await self.db.execute(
            select(Connection)
            .options(
                selectinload(Connection.database_config),
                selectinload(Connection.filesystem_config),
            )
            .where(Connection.id == connection_id)
        )
        conn = result.scalar_one_or_none()

        if conn is None:
            raise ConnectionNotFoundError(f"Connection {connection_id} not found")

        # Check for duplicate name if changing
        if input.name and input.name != conn.name:
            result = await self.db.execute(
                select(Connection).where(Connection.name == input.name)
            )
            if result.scalar_one_or_none():
                raise DuplicateConnectionError(
                    f"Connection with name '{input.name}' already exists"
                )
            conn.name = input.name

        # Update common fields
        if input.description is not None:
            conn.description = input.description
        if input.read_only is not None:
            conn.read_only = input.read_only

        # Update type-specific fields
        if isinstance(input, UpdateDatabaseConnectionInput) and conn.database_config:
            db_cfg = conn.database_config
            if input.host is not None:
                db_cfg.host = input.host
            if input.port is not None:
                db_cfg.port = input.port
            if input.database is not None:
                db_cfg.database = input.database

            # Update credentials if provided
            if input.username is not None or input.password is not None:
                current_username, current_password = self._decrypt_credentials(
                    db_cfg.encrypted_credentials
                )
                new_username = input.username if input.username is not None else current_username
                new_password = input.password if input.password is not None else current_password
                db_cfg.encrypted_credentials = self._encrypt_credentials(new_username, new_password)

        elif isinstance(input, UpdateFilesystemConnectionInput) and conn.filesystem_config:
            fs_cfg = conn.filesystem_config
            if input.path is not None:
                fs_cfg.path = input.path
            if input.path_type is not None:
                fs_cfg.path_type = input.path_type.value

        await self.db.commit()
        await self.db.refresh(conn, ["database_config", "filesystem_config"])

        logger.info(f"Updated connection '{conn.name}' (id={conn.id})")
        return self._model_to_info(conn)

    async def delete_connection(self, connection_id: UUID | str) -> bool:
        """Delete a connection.

        Cascade deletes handle type-specific config tables.

        Args:
            connection_id: The connection UUID.

        Returns:
            True if deleted, False if not found.
        """
        if isinstance(connection_id, str):
            connection_id = UUID(connection_id)

        result = await self.db.execute(select(Connection).where(Connection.id == connection_id))
        conn = result.scalar_one_or_none()

        if conn is None:
            return False

        await self.db.delete(conn)
        await self.db.commit()

        logger.info(f"Deleted connection '{conn.name}' (id={conn.id})")
        return True

    async def resolve_connection(
        self, connection_id: UUID | str
    ) -> ResolvedDatabaseConnection | ResolvedFilesystemConnection | None:
        """Resolve a connection with decrypted credentials (for database type).

        WARNING: For database connections, this returns plaintext credentials.
        Only use for authenticated server requests during workflow execution.

        Args:
            connection_id: The connection UUID.

        Returns:
            ResolvedDatabaseConnection or ResolvedFilesystemConnection, or None if not found.
        """
        if isinstance(connection_id, str):
            connection_id = UUID(connection_id)

        result = await self.db.execute(
            select(Connection)
            .options(
                selectinload(Connection.database_config),
                selectinload(Connection.filesystem_config),
            )
            .where(Connection.id == connection_id)
        )
        conn = result.scalar_one_or_none()

        if conn is None:
            return None

        if conn.type == ConnectionType.DATABASE.value and conn.database_config:
            db_cfg = conn.database_config
            username, password = self._decrypt_credentials(db_cfg.encrypted_credentials)

            return ResolvedDatabaseConnection(
                id=str(conn.id),
                name=conn.name,
                type="database",
                read_only=conn.read_only,
                db_type=DatabaseType(db_cfg.db_type),
                host=db_cfg.host,
                port=db_cfg.port,
                database=db_cfg.database,
                username=username,
                password=password,
            )
        elif conn.type == ConnectionType.FILESYSTEM.value and conn.filesystem_config:
            fs_cfg = conn.filesystem_config

            return ResolvedFilesystemConnection(
                id=str(conn.id),
                name=conn.name,
                type="filesystem",
                read_only=conn.read_only,
                path=fs_cfg.path,
                path_type=PathType(fs_cfg.path_type),
            )

        return None


# Factory function for dependency injection


async def get_connection_store(db: AsyncSession) -> ConnectionStore:
    """Create a ConnectionStore with the provided database session.

    For use as a FastAPI dependency. If encryption key is not configured,
    returns None to allow the app to function without connection management.

    Args:
        db: Async database session.

    Returns:
        ConnectionStore instance, or raises if encryption key missing.
    """
    if not settings.connection_encryption_key:
        raise EncryptionKeyError(
            "CONNECTION_ENCRYPTION_KEY not configured. "
            "Connection management is disabled."
        )

    return ConnectionStore(db)
