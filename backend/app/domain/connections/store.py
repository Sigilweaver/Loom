"""
Encrypted connection store for server-side credential management.

Uses Fernet symmetric encryption with a master key from environment variable.
Stores connections in a JSON file with credentials encrypted at rest.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any
from urllib.parse import quote as url_quote
from uuid import uuid4

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings
from app.domain.connections.models import (
    ConnectionInfo,
    CreateConnectionInput,
    ResolvedConnection,
    StoredConnection,
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
    """
    Encrypted credential store for server-managed database connections.
    
    Credentials are encrypted using Fernet (AES-128-CBC with HMAC).
    The encryption key must be provided via environment variable.
    
    Storage format: JSON file with encrypted credential blobs.
    """

    def __init__(self, storage_path: str | Path | None = None, encryption_key: str | None = None):
        """
        Initialize the connection store.
        
        Args:
            storage_path: Path to JSON storage file (uses config default if None)
            encryption_key: Fernet key (uses env var if None, pass "" to explicitly disable)
        """
        self._storage_path = Path(storage_path or settings.connection_store_path)
        # Only fall back to settings if encryption_key is None (not empty string)
        self._encryption_key = encryption_key if encryption_key is not None else settings.connection_encryption_key
        self._fernet: Fernet | None = None
        self._connections: dict[str, StoredConnection] = {}
        
        # Initialize encryption if key is available
        if self._encryption_key:
            try:
                self._fernet = Fernet(self._encryption_key.encode())
            except Exception as e:
                logger.error(f"Invalid encryption key format: {e}")
                raise EncryptionKeyError(
                    "Invalid CONNECTION_ENCRYPTION_KEY format. "
                    "Must be a valid Fernet key (32 url-safe base64-encoded bytes)."
                )
        
        # Load existing connections
        self._load()

    @property
    def is_enabled(self) -> bool:
        """Check if the connection store is enabled (has valid encryption key)."""
        return self._fernet is not None

    def _load(self) -> None:
        """Load connections from disk."""
        if not self._storage_path.exists():
            self._connections = {}
            return

        try:
            with open(self._storage_path, "r") as f:
                data = json.load(f)
            
            self._connections = {}
            for conn_id, conn_data in data.get("connections", {}).items():
                # Parse dates
                conn_data["created_at"] = datetime.fromisoformat(conn_data["created_at"])
                conn_data["updated_at"] = datetime.fromisoformat(conn_data["updated_at"])
                self._connections[conn_id] = StoredConnection(**conn_data)
                
            logger.info(f"Loaded {len(self._connections)} connections from {self._storage_path}")
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse connection store: {e}")
            self._connections = {}
        except Exception as e:
            logger.error(f"Failed to load connection store: {e}")
            self._connections = {}

    def _save(self) -> None:
        """Save connections to disk."""
        # Ensure directory exists
        self._storage_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Serialize connections
        data = {
            "connections": {
                conn_id: {
                    **conn.model_dump(),
                    "created_at": conn.created_at.isoformat(),
                    "updated_at": conn.updated_at.isoformat(),
                }
                for conn_id, conn in self._connections.items()
            }
        }
        
        with open(self._storage_path, "w") as f:
            json.dump(data, f, indent=2)
        
        logger.debug(f"Saved {len(self._connections)} connections to {self._storage_path}")

    def _encrypt_credentials(self, username: str, password: str) -> str:
        """Encrypt credentials using Fernet."""
        if not self._fernet:
            raise EncryptionKeyError("Encryption not available - no key configured")
        
        creds = json.dumps({"username": username, "password": password})
        encrypted = self._fernet.encrypt(creds.encode())
        return encrypted.decode()

    def _decrypt_credentials(self, encrypted: str) -> dict[str, str]:
        """Decrypt credentials using Fernet."""
        if not self._fernet:
            raise EncryptionKeyError("Decryption not available - no key configured")
        
        try:
            decrypted = self._fernet.decrypt(encrypted.encode())
            return json.loads(decrypted.decode())
        except InvalidToken:
            raise EncryptionKeyError("Failed to decrypt credentials - key may have changed")

    def _to_info(self, conn: StoredConnection) -> ConnectionInfo:
        """Convert stored connection to public info (no credentials)."""
        return ConnectionInfo(
            id=conn.id,
            name=conn.name,
            type=conn.type,
            owner="server",
            host=conn.host,
            port=conn.port,
            database=conn.database,
            createdAt=conn.created_at,
            updatedAt=conn.updated_at,
        )

    def list_connections(self) -> list[ConnectionInfo]:
        """List all connections (without credentials)."""
        return [self._to_info(conn) for conn in self._connections.values()]

    def get_connection(self, connection_id: str) -> ConnectionInfo | None:
        """Get connection info by ID (without credentials)."""
        conn = self._connections.get(connection_id)
        return self._to_info(conn) if conn else None

    def resolve_connection(self, connection_id: str) -> ResolvedConnection | None:
        """
        Resolve connection with decrypted credentials.
        
        WARNING: Returns sensitive data - use only for building connection URIs
        during workflow execution. Never expose to API responses.
        """
        conn = self._connections.get(connection_id)
        if not conn:
            return None
        
        creds = self._decrypt_credentials(conn.encrypted_credentials)
        
        return ResolvedConnection(
            id=conn.id,
            name=conn.name,
            type=conn.type,
            host=conn.host,
            port=conn.port,
            database=conn.database,
            username=creds["username"],
            password=creds["password"],
        )

    def build_connection_uri(self, connection_id: str) -> str | None:
        """
        Build a connection URI for the given connection ID.
        
        Returns URI with embedded credentials for use with Polars/connectorx.
        Returns None if connection not found.
        """
        resolved = self.resolve_connection(connection_id)
        if not resolved:
            return None
        
        # URL-encode username and password to handle special characters
        encoded_user = url_quote(resolved.username, safe="")
        encoded_pass = url_quote(resolved.password, safe="")
        
        return f"{resolved.type.value}://{encoded_user}:{encoded_pass}@{resolved.host}:{resolved.port}/{resolved.database}"

    def create_connection(self, input: CreateConnectionInput) -> ConnectionInfo:
        """Create a new connection."""
        if not self._fernet:
            raise EncryptionKeyError("Cannot create connections - no encryption key configured")
        
        # Check for duplicate names
        existing_names = {c.name.lower() for c in self._connections.values()}
        if input.name.lower() in existing_names:
            raise DuplicateConnectionError(f"A connection named '{input.name}' already exists")
        
        conn_id = str(uuid4())
        now = datetime.utcnow()
        
        stored = StoredConnection(
            id=conn_id,
            name=input.name,
            type=input.type,
            host=input.host,
            port=input.port,
            database=input.database,
            encrypted_credentials=self._encrypt_credentials(input.username, input.password),
            created_at=now,
            updated_at=now,
        )
        
        self._connections[conn_id] = stored
        self._save()
        
        logger.info(f"Created connection: {input.name} ({conn_id})")
        return self._to_info(stored)

    def update_connection(self, connection_id: str, input: UpdateConnectionInput) -> ConnectionInfo:
        """Update an existing connection."""
        conn = self._connections.get(connection_id)
        if not conn:
            raise ConnectionNotFoundError(f"Connection {connection_id} not found")
        
        # Check for duplicate names (excluding current)
        if input.name:
            existing_names = {
                c.name.lower() for c in self._connections.values()
                if c.id != connection_id
            }
            if input.name.lower() in existing_names:
                raise DuplicateConnectionError(f"A connection named '{input.name}' already exists")
        
        # Update non-credential fields
        if input.name is not None:
            conn.name = input.name
        if input.host is not None:
            conn.host = input.host
        if input.port is not None:
            conn.port = input.port
        if input.database is not None:
            conn.database = input.database
        
        # Update credentials if provided
        if input.username is not None or input.password is not None:
            current_creds = self._decrypt_credentials(conn.encrypted_credentials)
            new_username = input.username if input.username is not None else current_creds["username"]
            new_password = input.password if input.password is not None else current_creds["password"]
            conn.encrypted_credentials = self._encrypt_credentials(new_username, new_password)
        
        conn.updated_at = datetime.utcnow()
        self._connections[connection_id] = conn
        self._save()
        
        logger.info(f"Updated connection: {conn.name} ({connection_id})")
        return self._to_info(conn)

    def delete_connection(self, connection_id: str) -> None:
        """Delete a connection."""
        conn = self._connections.get(connection_id)
        if not conn:
            raise ConnectionNotFoundError(f"Connection {connection_id} not found")
        
        del self._connections[connection_id]
        self._save()
        
        logger.info(f"Deleted connection: {conn.name} ({connection_id})")

    def has_connection(self, connection_id: str) -> bool:
        """Check if a connection exists."""
        return connection_id in self._connections


# Singleton instance
_connection_store: ConnectionStore | None = None


def get_connection_store() -> ConnectionStore:
    """
    Get the singleton connection store instance.
    
    Lazy initialization - created on first access.
    """
    global _connection_store
    if _connection_store is None:
        _connection_store = ConnectionStore()
    return _connection_store


def reset_connection_store() -> None:
    """Reset the singleton instance (for testing)."""
    global _connection_store
    _connection_store = None
