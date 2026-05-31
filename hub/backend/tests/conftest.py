"""Shared test fixtures for Hub backend tests.

Provides role-based user fixtures and common test utilities.
All permission tests should use these fixtures to ensure consistency.

PERFORMANCE OPTIMIZATION:
- Session-scoped database: Tables created once per test session, not per test
- Direct DB inserts: Users created directly in DB, not via HTTP endpoints
- Pre-computed password hash: Single hash reused for all test users
- TRUNCATE cleanup: Fast table clearing between tests (vs DROP/CREATE)

This reduces test time from ~90s to ~15-20s by eliminating:
- 306 DROP/CREATE cycles
- 306+ HTTP requests for user creation
- 306+ password hash operations
"""

import tempfile
import uuid
from datetime import UTC, datetime, timedelta
from typing import AsyncGenerator

# Set required-secret env vars before importing app.main (WP-03 enforces a
# hard fail at startup when any required secret is unset). Using deterministic
# test values keeps fixtures reproducible.
import os as _os

from cryptography.fernet import Fernet as _Fernet

_os.environ.setdefault("SESSION_SECRET", "test-session-secret-do-not-use-in-prod")
_os.environ.setdefault("SECRET_KEY", "test-secret-key-do-not-use-in-prod")
_os.environ.setdefault("SERVER_REGISTRATION_SECRET", "test-registration-secret")
_os.environ.setdefault("CONNECTION_ENCRYPTION_KEY", _Fernet.generate_key().decode())

import pytest
from argon2 import PasswordHasher
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import settings
from app.db.database import get_db
from app.db.models import Base, Session, User
from app.domain.auth.sessions import generate_session_token, hash_token
from app.main import app

# =============================================================================
# Fast Password Hashing for Tests
# =============================================================================
# Production uses time_cost=2, memory_cost=65536 (64MB) which is secure but slow.
# For tests, we use minimal settings to speed up user creation significantly.

import app.domain.auth.password as password_module

_fast_hasher = PasswordHasher(
    time_cost=1,
    memory_cost=1024,  # 1MB instead of 64MB
    parallelism=1,
)
password_module._hasher = _fast_hasher

# Pre-compute password hash ONCE for all test users (all use "password123")
# This eliminates hashing overhead during test setup
_TEST_PASSWORD_HASH = _fast_hasher.hash("password123")

# =============================================================================
# Database Configuration
# =============================================================================

# Connection URL to the main database (used for creating test database)
ADMIN_DATABASE_URL = "postgresql+asyncpg://sigilweaver_loom:sigilweaver_loom@localhost:25801/sigilweaver_loom_hub"
TEST_DATABASE_URL = "postgresql+asyncpg://sigilweaver_loom:sigilweaver_loom@localhost:25801/sigilweaver_loom_hub_test"

# Admin engine for database creation (connects to main db)
admin_engine = create_async_engine(
    ADMIN_DATABASE_URL,
    echo=False,
    isolation_level="AUTOCOMMIT",  # Required for CREATE DATABASE
    poolclass=NullPool,
)

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    poolclass=NullPool,
)
TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override database dependency for tests."""
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_db] = override_get_db


def new_client():
    """Create a new test client instance."""
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    )


# =============================================================================
# Session-Scoped Database Setup (runs ONCE per test session)
# =============================================================================


@pytest.fixture(scope="session")
def event_loop_policy():
    """Use default event loop policy."""
    import asyncio
    return asyncio.DefaultEventLoopPolicy()


@pytest.fixture(scope="session")
async def _ensure_test_db():
    """Create the test database if it doesn't exist."""
    async with admin_engine.connect() as conn:
        # Check if database exists
        result = await conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = 'sigilweaver_loom_hub_test'")
        )
        exists = result.scalar() is not None
        
        if not exists:
            await conn.execute(text("CREATE DATABASE sigilweaver_loom_hub_test"))
    
    await admin_engine.dispose()
    yield


@pytest.fixture(scope="session")
async def _create_tables(_ensure_test_db):
    """Create all tables once at the start of the test session."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    # Drop tables at end of session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# Get all table names for TRUNCATE (order matters due to FK constraints)
# These must match the actual table names from Base.metadata
_TABLE_NAMES = [
    "execution_artifacts",
    "execution_records",
    "executions",
    "schedules",
    "workflow_revisions",
    "workflows", 
    "server_groups",
    "servers",
    "grant_group_connections",
    "user_group_grant_groups",
    "grant_groups",
    "connections",
    "user_groups",
    "groups",
    "sessions",
    "users",
    "audit_events",
]


# =============================================================================
# Function-Scoped Test Isolation (runs per test)
# =============================================================================


@pytest.fixture(scope="function")
async def temp_storage():
    """Create temporary storage for workflow files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        original = settings.workflow_storage_path
        settings.workflow_storage_path = tmpdir
        yield tmpdir
        settings.workflow_storage_path = original


@pytest.fixture(scope="function")
async def setup_database(_create_tables, temp_storage):
    """Clear tables before each test using TRUNCATE.
    
    TRUNCATE is MUCH faster than DROP/CREATE because:
    1. No schema introspection needed
    2. No table recreation
    3. Just marks pages as empty
    """
    # TRUNCATE all tables with CASCADE to handle foreign keys
    async with test_engine.begin() as conn:
        # Use a single TRUNCATE statement with CASCADE for speed
        tables = ", ".join(_TABLE_NAMES)
        await conn.execute(text(f"TRUNCATE TABLE {tables} RESTART IDENTITY CASCADE"))
    
    yield


@pytest.fixture
def client(setup_database):
    """Create test client with database setup."""
    return new_client()


# =============================================================================
# Direct User Creation Helpers (bypasses HTTP, ~10x faster)
# =============================================================================


async def create_user_direct(
    username: str,
    role: str,
) -> tuple[User, str]:
    """Create a user directly in the database and return user + auth token.
    
    This bypasses HTTP endpoints and password hashing (uses pre-computed hash),
    making it ~10x faster than the HTTP-based approach.
    
    Returns:
        Tuple of (User object, bearer token string)
    """
    async with TestSessionLocal() as session:
        # Create user with pre-computed password hash
        user = User(
            id=uuid.uuid4(),
            username=username,
            password_hash=_TEST_PASSWORD_HASH,
            role=role,
        )
        session.add(user)
        await session.flush()
        
        # Create session token directly
        token = generate_session_token()
        token_hash = hash_token(token)
        expires_at = datetime.now(UTC) + timedelta(hours=24)
        
        db_session = Session(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        session.add(db_session)
        await session.commit()
        
        return user, token


# =============================================================================
# Role-Based User Fixtures (FAST - direct DB insert)
# =============================================================================
# Note: Each fixture creates only the users it needs. Some tests use multiple
# role fixtures (e.g., admin_headers + owner_headers), so we need to handle
# potential duplicate creation gracefully.


async def ensure_owner_exists() -> tuple[User, str]:
    """Ensure owner user exists, creating if needed. Returns (user, token)."""
    async with TestSessionLocal() as session:
        from sqlalchemy import select
        result = await session.execute(select(User).where(User.username == "owner"))
        existing = result.scalar_one_or_none()
        if existing:
            # Owner exists, just create a new session token
            token = generate_session_token()
            token_hash = hash_token(token)
            expires_at = datetime.now(UTC) + timedelta(hours=24)
            db_session = Session(
                user_id=existing.id,
                token_hash=token_hash,
                expires_at=expires_at,
            )
            session.add(db_session)
            await session.commit()
            return existing, token
        else:
            return await create_user_direct("owner", "owner")


@pytest.fixture
async def owner_headers(setup_database) -> dict[str, str]:
    """Create owner user and return auth headers."""
    _, token = await ensure_owner_exists()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_headers(setup_database) -> dict[str, str]:
    """Create admin user and return auth headers."""
    await ensure_owner_exists()
    _, token = await create_user_direct("admin", "admin")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def auditor_headers(setup_database) -> dict[str, str]:
    """Create auditor user and return auth headers."""
    await ensure_owner_exists()
    _, token = await create_user_direct("auditor", "auditor")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def user_headers(setup_database) -> dict[str, str]:
    """Create regular user and return auth headers."""
    await ensure_owner_exists()
    _, token = await create_user_direct("testuser", "user")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def second_user_headers(setup_database) -> dict[str, str]:
    """Create a second regular user for ownership boundary testing."""
    await ensure_owner_exists()
    _, token = await create_user_direct("otheruser", "user")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def second_user_info(setup_database, second_user_headers) -> dict:
    """Get info for the second user including their ID."""
    async with new_client() as client:
        response = await client.get("/api/v1/auth/me", headers=second_user_headers)
        assert response.status_code == 200
        return response.json()


# =============================================================================
# Resource Fixtures
# =============================================================================


@pytest.fixture
async def test_group(setup_database, owner_headers) -> dict:
    """Create a test group and return its data."""
    async with new_client() as client:
        response = await client.post(
            "/api/v1/groups",
            headers=owner_headers,
            json={"name": "Test Group", "description": "A test group"},
        )
        assert response.status_code == 201
        return response.json()


@pytest.fixture
async def user_in_group(setup_database, owner_headers, user_headers, test_group) -> dict:
    """Add the test user to the test group.

    Returns the user info after being added to the group.
    """
    async with new_client() as client:
        # Get user ID from /me endpoint
        response = await client.get("/api/v1/auth/me", headers=user_headers)
        user_data = response.json()
        user_id = user_data["id"]

        # Add user to group via /users/{id}/groups endpoint
        response = await client.post(
            f"/api/v1/users/{user_id}/groups/{test_group['id']}",
            headers=owner_headers,
        )
        assert response.status_code == 201, f"Failed to add user to group: {response.text}"

        return {"user_id": user_id, "group_id": test_group["id"]}


@pytest.fixture
async def test_server(setup_database) -> dict:
    """Register a test server and return its data.

    Note: Server registration doesn't require auth if no secret is configured.
    """
    # Temporarily disable server registration secret for testing
    original_secret = settings.server_registration_secret
    settings.server_registration_secret = ""

    try:
        async with new_client() as client:
            response = await client.post(
                "/api/v1/servers",
                json={
                    "name": "Test Server",
                    "endpoint_url": "http://localhost:25811",
                    "auth_token": "test-token",
                },
            )
            assert response.status_code == 201, f"Server registration failed: {response.text}"
            return response.json()
    finally:
        settings.server_registration_secret = original_secret


@pytest.fixture
async def server_in_group(setup_database, owner_headers, test_server, test_group) -> dict:
    """Assign the test server to the test group."""
    async with new_client() as client:
        response = await client.post(
            f"/api/v1/servers/{test_server['id']}/groups/{test_group['id']}",
            headers=owner_headers,
        )
        assert response.status_code == 201
        return {"server_id": test_server["id"], "group_id": test_group["id"]}


# =============================================================================
# Workflow Helpers
# =============================================================================


def make_workflow_content(
    name: str = "Test Workflow",
    description: str = "A test workflow",
    author: str = "Test Author",
    workflow_id: str = "d7f0101e-6151-46fa-922d-c081146a19c8",
) -> bytes:
    """Create valid workflow file content."""
    import json

    return json.dumps({
        "version": "2.0",
        "meta": {
            "name": name,
            "description": description,
            "author": author,
            "workflowId": workflow_id,
            "created": "2025-11-28T01:27:00.041Z",
        },
        "tools": [
            {
                "id": "RLOJUUyx",
                "type": "Input",
                "x": -300,
                "y": 180,
                "config": {"category": "file", "type": "csv"},
                "sockets": [{"id": 0, "direction": "output"}],
            }
        ],
        "wires": [],
    }).encode("utf-8")
