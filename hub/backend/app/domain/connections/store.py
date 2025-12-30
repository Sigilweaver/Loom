"""Encrypted connection store backed by PostgreSQL.

This module provides encrypted storage for database connection credentials.
Credentials are encrypted using Fernet (AES-128-CBC with HMAC) before
storage. The encryption key must be provided via environment variable.

Unlike the Server's file-based store, this uses async SQLAlchemy for
database-backed storage suitable for multi-instance Hub deployments.
"""

import json
import logging
from uuid import UUID

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Connection
from app.domain.connections.models import (
    ConnectionInfo,
    CreateConnectionInput,
    ResolvedConnection,
    UpdateConnectionInput,
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
        return ConnectionInfo(
            id=str(conn.id),
            name=conn.name,
            type=conn.type,
            host=conn.host,
            port=conn.port,
            database=conn.database,
            status=conn.status,
            last_checked=conn.last_checked,
            last_healthy=conn.last_healthy,
            last_error=conn.last_error,
            created_by=conn.created_by,
            created_at=conn.created_at,
            updated_at=conn.updated_at,
        )

    async def list_connections(self) -> list[ConnectionInfo]:
        """List all connections (without credentials).

        Returns:
            List of ConnectionInfo objects.
        """
        result = await self.db.execute(select(Connection).order_by(Connection.name))
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

        result = await self.db.execute(select(Connection).where(Connection.id == connection_id))
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
            input: Connection details including credentials.
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

        # Encrypt credentials
        encrypted = self._encrypt_credentials(input.username, input.password)

        # Create model
        conn = Connection(
            name=input.name,
            type=input.type.value,
            host=input.host,
            port=input.port,
            database=input.database,
            encrypted_credentials=encrypted,
            created_by=created_by,
        )

        self.db.add(conn)
        await self.db.commit()
        await self.db.refresh(conn)

        logger.info(f"Created connection '{conn.name}' (id={conn.id}) by {created_by}")
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

        result = await self.db.execute(select(Connection).where(Connection.id == connection_id))
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

        # Update other fields
        if input.host is not None:
            conn.host = input.host
        if input.port is not None:
            conn.port = input.port
        if input.database is not None:
            conn.database = input.database

        # Update credentials if provided
        if input.username is not None or input.password is not None:
            # Get current credentials
            current_username, current_password = self._decrypt_credentials(
                conn.encrypted_credentials
            )

            # Apply updates
            new_username = input.username if input.username is not None else current_username
            new_password = input.password if input.password is not None else current_password

            conn.encrypted_credentials = self._encrypt_credentials(new_username, new_password)

        await self.db.commit()
        await self.db.refresh(conn)

        logger.info(f"Updated connection '{conn.name}' (id={conn.id})")
        return self._model_to_info(conn)

    async def delete_connection(self, connection_id: UUID | str) -> bool:
        """Delete a connection.

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

    async def resolve_connection(self, connection_id: UUID | str) -> ResolvedConnection | None:
        """Resolve a connection with decrypted credentials.

        WARNING: This returns plaintext credentials. Only use for
        authenticated server requests during workflow execution.

        Args:
            connection_id: The connection UUID.

        Returns:
            ResolvedConnection with decrypted credentials, or None if not found.
        """
        if isinstance(connection_id, str):
            connection_id = UUID(connection_id)

        result = await self.db.execute(select(Connection).where(Connection.id == connection_id))
        conn = result.scalar_one_or_none()

        if conn is None:
            return None

        username, password = self._decrypt_credentials(conn.encrypted_credentials)

        return ResolvedConnection(
            id=str(conn.id),
            name=conn.name,
            type=conn.type,
            host=conn.host,
            port=conn.port,
            database=conn.database,
            username=username,
            password=password,
        )


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
