"""Tests for server connection store and API."""

import json
import tempfile
from pathlib import Path

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient

from app.domain.connections.models import (
    ConnectionInfo,
    CreateConnectionInput,
    DatabaseType,
    UpdateConnectionInput,
)
from app.domain.connections.store import (
    ConnectionNotFoundError,
    ConnectionStore,
    DuplicateConnectionError,
    EncryptionKeyError,
    reset_connection_store,
)


class TestConnectionStore:
    """Tests for the ConnectionStore class."""

    @pytest.fixture
    def encryption_key(self) -> str:
        """Generate a valid Fernet key for testing."""
        return Fernet.generate_key().decode()

    @pytest.fixture
    def temp_storage(self) -> Path:
        """Create a temporary storage file."""
        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
            return Path(f.name)

    @pytest.fixture
    def store(self, temp_storage: Path, encryption_key: str) -> ConnectionStore:
        """Create a test connection store."""
        return ConnectionStore(storage_path=temp_storage, encryption_key=encryption_key)

    def test_store_creation_with_valid_key(self, temp_storage: Path, encryption_key: str):
        """Store should initialize with a valid encryption key."""
        store = ConnectionStore(storage_path=temp_storage, encryption_key=encryption_key)
        assert store.is_enabled is True
        assert store.list_connections() == []

    def test_store_creation_without_key(self, temp_storage: Path):
        """Store should be disabled without encryption key."""
        store = ConnectionStore(storage_path=temp_storage, encryption_key="")
        assert store.is_enabled is False

    def test_store_creation_with_invalid_key(self, temp_storage: Path):
        """Store should raise error with invalid key format."""
        with pytest.raises(EncryptionKeyError):
            ConnectionStore(storage_path=temp_storage, encryption_key="invalid-key")

    def test_create_connection(self, store: ConnectionStore):
        """Should create a new connection with encrypted credentials."""
        input_data = CreateConnectionInput(
            name="Test DB",
            type=DatabaseType.POSTGRESQL,
            host="localhost",
            port=5432,
            database="testdb",
            username="testuser",
            password="testpass123",
        )

        result = store.create_connection(input_data)

        assert result.id is not None
        assert result.name == "Test DB"
        assert result.type == DatabaseType.POSTGRESQL
        assert result.host == "localhost"
        assert result.port == 5432
        assert result.database == "testdb"
        assert result.owner == "server"
        # Verify credentials are not exposed in ConnectionInfo
        assert not hasattr(result, "username")
        assert not hasattr(result, "password")

    def test_create_duplicate_name_fails(self, store: ConnectionStore):
        """Should reject duplicate connection names (case-insensitive)."""
        input_data = CreateConnectionInput(
            name="Test DB",
            type=DatabaseType.POSTGRESQL,
            host="localhost",
            port=5432,
            database="testdb",
            username="user",
            password="pass",
        )
        store.create_connection(input_data)

        # Try to create another with same name (different case)
        duplicate = CreateConnectionInput(
            name="test db",
            type=DatabaseType.MYSQL,
            host="other-host",
            port=3306,
            database="otherdb",
            username="user2",
            password="pass2",
        )
        with pytest.raises(DuplicateConnectionError):
            store.create_connection(duplicate)

    def test_list_connections(self, store: ConnectionStore):
        """Should list all connections without credentials."""
        # Create multiple connections
        for i in range(3):
            store.create_connection(
                CreateConnectionInput(
                    name=f"DB {i}",
                    type=DatabaseType.POSTGRESQL,
                    host=f"host{i}",
                    port=5432,
                    database=f"db{i}",
                    username=f"user{i}",
                    password=f"pass{i}",
                )
            )

        connections = store.list_connections()
        assert len(connections) == 3
        assert all(c.owner == "server" for c in connections)

    def test_get_connection(self, store: ConnectionStore):
        """Should get a single connection by ID."""
        created = store.create_connection(
            CreateConnectionInput(
                name="Test DB",
                type=DatabaseType.POSTGRESQL,
                host="localhost",
                port=5432,
                database="testdb",
                username="user",
                password="pass",
            )
        )

        result = store.get_connection(created.id)
        assert result is not None
        assert result.id == created.id
        assert result.name == "Test DB"

    def test_get_nonexistent_connection(self, store: ConnectionStore):
        """Should return None for nonexistent connection."""
        result = store.get_connection("nonexistent-id")
        assert result is None

    def test_resolve_connection(self, store: ConnectionStore):
        """Should resolve connection with decrypted credentials."""
        created = store.create_connection(
            CreateConnectionInput(
                name="Test DB",
                type=DatabaseType.POSTGRESQL,
                host="localhost",
                port=5432,
                database="testdb",
                username="secretuser",
                password="secretpass",
            )
        )

        resolved = store.resolve_connection(created.id)
        assert resolved is not None
        assert resolved.username == "secretuser"
        assert resolved.password == "secretpass"

    def test_build_connection_uri(self, store: ConnectionStore):
        """Should build valid connection URI with credentials."""
        created = store.create_connection(
            CreateConnectionInput(
                name="Test DB",
                type=DatabaseType.POSTGRESQL,
                host="localhost",
                port=5432,
                database="testdb",
                username="user",
                password="pass",
            )
        )

        uri = store.build_connection_uri(created.id)
        assert uri == "postgresql://user:pass@localhost:5432/testdb"

    def test_build_connection_uri_with_special_chars(self, store: ConnectionStore):
        """Should URL-encode special characters in credentials."""
        created = store.create_connection(
            CreateConnectionInput(
                name="Test DB",
                type=DatabaseType.POSTGRESQL,
                host="localhost",
                port=5432,
                database="testdb",
                username="user@domain",
                password="p@ss:word/123",
            )
        )

        uri = store.build_connection_uri(created.id)
        # Special chars should be URL-encoded
        assert "user%40domain" in uri
        assert "p%40ss%3Aword%2F123" in uri

    def test_update_connection(self, store: ConnectionStore):
        """Should update connection fields."""
        created = store.create_connection(
            CreateConnectionInput(
                name="Old Name",
                type=DatabaseType.POSTGRESQL,
                host="oldhost",
                port=5432,
                database="olddb",
                username="user",
                password="pass",
            )
        )

        updated = store.update_connection(
            created.id,
            UpdateConnectionInput(
                name="New Name",
                host="newhost",
            ),
        )

        assert updated.name == "New Name"
        assert updated.host == "newhost"
        # Unchanged fields should remain
        assert updated.port == 5432

    def test_update_credentials(self, store: ConnectionStore):
        """Should update credentials while keeping them encrypted."""
        created = store.create_connection(
            CreateConnectionInput(
                name="Test DB",
                type=DatabaseType.POSTGRESQL,
                host="localhost",
                port=5432,
                database="testdb",
                username="olduser",
                password="oldpass",
            )
        )

        store.update_connection(
            created.id,
            UpdateConnectionInput(password="newpass"),
        )

        resolved = store.resolve_connection(created.id)
        assert resolved.username == "olduser"  # Unchanged
        assert resolved.password == "newpass"  # Updated

    def test_update_nonexistent_fails(self, store: ConnectionStore):
        """Should raise error when updating nonexistent connection."""
        with pytest.raises(ConnectionNotFoundError):
            store.update_connection(
                "nonexistent-id",
                UpdateConnectionInput(name="New Name"),
            )

    def test_delete_connection(self, store: ConnectionStore):
        """Should delete a connection."""
        created = store.create_connection(
            CreateConnectionInput(
                name="Test DB",
                type=DatabaseType.POSTGRESQL,
                host="localhost",
                port=5432,
                database="testdb",
                username="user",
                password="pass",
            )
        )

        store.delete_connection(created.id)
        assert store.get_connection(created.id) is None

    def test_delete_nonexistent_fails(self, store: ConnectionStore):
        """Should raise error when deleting nonexistent connection."""
        with pytest.raises(ConnectionNotFoundError):
            store.delete_connection("nonexistent-id")

    def test_persistence(self, temp_storage: Path, encryption_key: str):
        """Connections should persist across store instances."""
        # Create connection in first store instance
        store1 = ConnectionStore(storage_path=temp_storage, encryption_key=encryption_key)
        created = store1.create_connection(
            CreateConnectionInput(
                name="Persistent DB",
                type=DatabaseType.POSTGRESQL,
                host="localhost",
                port=5432,
                database="testdb",
                username="user",
                password="secret",
            )
        )

        # Create new store instance pointing to same file
        store2 = ConnectionStore(storage_path=temp_storage, encryption_key=encryption_key)
        
        # Should be able to read the connection
        loaded = store2.get_connection(created.id)
        assert loaded is not None
        assert loaded.name == "Persistent DB"

        # Should be able to decrypt credentials
        resolved = store2.resolve_connection(created.id)
        assert resolved.password == "secret"

    def test_has_connection(self, store: ConnectionStore):
        """Should check if connection exists."""
        created = store.create_connection(
            CreateConnectionInput(
                name="Test DB",
                type=DatabaseType.POSTGRESQL,
                host="localhost",
                port=5432,
                database="testdb",
                username="user",
                password="pass",
            )
        )

        assert store.has_connection(created.id) is True
        assert store.has_connection("nonexistent") is False


class TestConnectionAPI:
    """Tests for the connection API endpoints."""

    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        """Reset the singleton store before each test."""
        reset_connection_store()
        yield
        reset_connection_store()

    @pytest.fixture
    def client_with_store(self, monkeypatch, tmp_path: Path):
        """Create test client with connection store enabled."""
        # Generate encryption key
        key = Fernet.generate_key().decode()
        storage_path = tmp_path / "test_connections.json"

        # Patch settings
        monkeypatch.setattr("app.config.settings.connection_encryption_key", key)
        monkeypatch.setattr("app.config.settings.connection_store_path", str(storage_path))
        monkeypatch.setattr("app.config.settings.auth_mode", "disabled")

        from app.main import app
        return TestClient(app)

    @pytest.fixture
    def client_without_store(self, monkeypatch):
        """Create test client with connection store disabled."""
        monkeypatch.setattr("app.config.settings.connection_encryption_key", "")
        monkeypatch.setattr("app.config.settings.auth_mode", "disabled")

        from app.main import app
        return TestClient(app)

    def test_get_status_enabled(self, client_with_store):
        """Should return enabled status when key is configured."""
        response = client_with_store.get("/api/connections/status")
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is True
        assert data["connectionCount"] == 0

    def test_get_status_disabled(self, client_without_store):
        """Should return disabled status when key is not configured."""
        response = client_without_store.get("/api/connections/status")
        assert response.status_code == 200
        data = response.json()
        assert data["enabled"] is False

    def test_list_connections_empty(self, client_with_store):
        """Should return empty list when no connections exist."""
        response = client_with_store.get("/api/connections/")
        assert response.status_code == 200
        assert response.json() == []

    def test_create_connection(self, client_with_store):
        """Should create a new connection."""
        response = client_with_store.post(
            "/api/connections/",
            json={
                "name": "Test DB",
                "type": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "testdb",
                "username": "user",
                "password": "pass",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test DB"
        assert data["owner"] == "server"
        assert "id" in data
        # Credentials should not be in response
        assert "username" not in data
        assert "password" not in data

    def test_create_connection_disabled_store(self, client_without_store):
        """Should return 503 when store is disabled."""
        response = client_without_store.post(
            "/api/connections/",
            json={
                "name": "Test DB",
                "type": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "testdb",
                "username": "user",
                "password": "pass",
            },
        )
        assert response.status_code == 503

    def test_create_duplicate_name(self, client_with_store):
        """Should return 409 for duplicate names."""
        # Create first connection
        client_with_store.post(
            "/api/connections/",
            json={
                "name": "Test DB",
                "type": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "testdb",
                "username": "user",
                "password": "pass",
            },
        )

        # Try to create duplicate
        response = client_with_store.post(
            "/api/connections/",
            json={
                "name": "Test DB",
                "type": "mysql",
                "host": "otherhost",
                "port": 3306,
                "database": "otherdb",
                "username": "user2",
                "password": "pass2",
            },
        )
        assert response.status_code == 409

    def test_get_connection(self, client_with_store):
        """Should get a connection by ID."""
        # Create connection
        create_response = client_with_store.post(
            "/api/connections/",
            json={
                "name": "Test DB",
                "type": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "testdb",
                "username": "user",
                "password": "pass",
            },
        )
        conn_id = create_response.json()["id"]

        # Get connection
        response = client_with_store.get(f"/api/connections/{conn_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == conn_id
        assert data["name"] == "Test DB"

    def test_get_nonexistent_connection(self, client_with_store):
        """Should return 404 for nonexistent connection."""
        response = client_with_store.get("/api/connections/nonexistent-id")
        assert response.status_code == 404

    def test_update_connection(self, client_with_store):
        """Should update a connection."""
        # Create connection
        create_response = client_with_store.post(
            "/api/connections/",
            json={
                "name": "Old Name",
                "type": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "testdb",
                "username": "user",
                "password": "pass",
            },
        )
        conn_id = create_response.json()["id"]

        # Update connection
        response = client_with_store.put(
            f"/api/connections/{conn_id}",
            json={"name": "New Name"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "New Name"

    def test_delete_connection(self, client_with_store):
        """Should delete a connection."""
        # Create connection
        create_response = client_with_store.post(
            "/api/connections/",
            json={
                "name": "Test DB",
                "type": "postgresql",
                "host": "localhost",
                "port": 5432,
                "database": "testdb",
                "username": "user",
                "password": "pass",
            },
        )
        conn_id = create_response.json()["id"]

        # Delete connection
        response = client_with_store.delete(f"/api/connections/{conn_id}")
        assert response.status_code == 204

        # Verify deleted
        get_response = client_with_store.get(f"/api/connections/{conn_id}")
        assert get_response.status_code == 404

    def test_delete_nonexistent_connection(self, client_with_store):
        """Should return 404 when deleting nonexistent connection."""
        response = client_with_store.delete("/api/connections/nonexistent-id")
        assert response.status_code == 404

    def test_list_after_create(self, client_with_store):
        """Should list created connections."""
        # Create two connections
        client_with_store.post(
            "/api/connections/",
            json={
                "name": "DB 1",
                "type": "postgresql",
                "host": "host1",
                "port": 5432,
                "database": "db1",
                "username": "user1",
                "password": "pass1",
            },
        )
        client_with_store.post(
            "/api/connections/",
            json={
                "name": "DB 2",
                "type": "mysql",
                "host": "host2",
                "port": 3306,
                "database": "db2",
                "username": "user2",
                "password": "pass2",
            },
        )

        # List all
        response = client_with_store.get("/api/connections/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        names = {c["name"] for c in data}
        assert names == {"DB 1", "DB 2"}
