"""Tests for authentication routes"""

import pytest

from tests.conftest import new_client, setup_database  # noqa: F401 - fixtures


@pytest.fixture
def client(setup_database):
    """Create test client - uses shared setup_database from conftest."""
    return new_client()


class TestAuthStatus:
    """Tests for /auth/status endpoint"""

    @pytest.mark.asyncio
    async def test_status_no_users(self, client):
        """Status shows registration open when no users exist"""
        async with client:
            response = await client.get("/api/auth/status")

        assert response.status_code == 200
        data = response.json()
        assert data["initialized"] is False
        assert data["registration_open"] is True
        assert data["user_count"] == 0


class TestRegister:
    """Tests for /auth/register endpoint"""

    @pytest.mark.asyncio
    async def test_first_user_becomes_owner(self, client):
        """First user to register becomes owner"""
        async with client:
            response = await client.post(
                "/api/auth/register",
                json={"username": "admin", "password": "password123"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["token_type"] == "bearer"
        assert data["access_token"]
        assert data["user"]["username"] == "admin"
        assert data["user"]["role"] == "owner"

    @pytest.mark.asyncio
    async def test_second_user_requires_auth(self, client):
        """Subsequent registrations require authentication"""
        async with client:
            # Create first user (owner)
            await client.post(
                "/api/auth/register",
                json={"username": "owner", "password": "password123"},
            )

            # Try to register without auth
            response = await client.post(
                "/api/auth/register",
                json={"username": "user2", "password": "password123"},
            )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_owner_can_register_users(self, client):
        """Owner can create new users"""
        async with client:
            # Create owner
            owner_response = await client.post(
                "/api/auth/register",
                json={"username": "owner", "password": "password123"},
            )
            owner_token = owner_response.json()["access_token"]

            # Register another user as owner
            response = await client.post(
                "/api/auth/register",
                json={"username": "user2", "password": "password123"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["user"]["username"] == "user2"
        assert data["user"]["role"] == "user"  # Default role for non-first users

    @pytest.mark.asyncio
    async def test_duplicate_username_rejected(self, client):
        """Cannot register with existing username"""
        async with client:
            # Create first user
            owner_response = await client.post(
                "/api/auth/register",
                json={"username": "admin", "password": "password123"},
            )
            owner_token = owner_response.json()["access_token"]

            # Try to register same username
            response = await client.post(
                "/api/auth/register",
                json={"username": "admin", "password": "different123"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )

        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_short_username_rejected(self, client):
        """Username must be at least 3 characters"""
        async with client:
            response = await client.post(
                "/api/auth/register",
                json={"username": "ab", "password": "password123"},
            )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_short_password_rejected(self, client):
        """Password must be at least 8 characters"""
        async with client:
            response = await client.post(
                "/api/auth/register",
                json={"username": "validuser", "password": "short"},
            )

        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_regular_user_cannot_register_others(self, client):
        """Regular users cannot create new users"""
        async with client:
            # Create owner
            owner_response = await client.post(
                "/api/auth/register",
                json={"username": "owner", "password": "password123"},
            )
            owner_token = owner_response.json()["access_token"]

            # Create regular user
            user_response = await client.post(
                "/api/auth/register",
                json={"username": "regularuser", "password": "password123"},
                headers={"Authorization": f"Bearer {owner_token}"},
            )
            user_token = user_response.json()["access_token"]

            # Regular user tries to register someone
            response = await client.post(
                "/api/auth/register",
                json={"username": "newuser", "password": "password123"},
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 403


class TestLogin:
    """Tests for /auth/login endpoint"""

    @pytest.mark.asyncio
    async def test_login_success(self, client):
        """Valid credentials return token"""
        async with client:
            # Create user first
            await client.post(
                "/api/auth/register",
                json={"username": "testuser", "password": "password123"},
            )

            # Login
            response = await client.post(
                "/api/auth/login",
                json={"username": "testuser", "password": "password123"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["token_type"] == "bearer"
        assert data["access_token"]
        assert data["user"]["username"] == "testuser"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client):
        """Wrong password returns 401"""
        async with client:
            # Create user
            await client.post(
                "/api/auth/register",
                json={"username": "testuser", "password": "password123"},
            )

            # Login with wrong password
            response = await client.post(
                "/api/auth/login",
                json={"username": "testuser", "password": "wrongpassword"},
            )

        assert response.status_code == 401
        assert "Invalid" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client):
        """Nonexistent user returns 401"""
        async with client:
            response = await client.post(
                "/api/auth/login",
                json={"username": "nobody", "password": "password123"},
            )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_returns_different_tokens(self, client):
        """Each login creates a new session with unique token"""
        async with client:
            # Create user
            await client.post(
                "/api/auth/register",
                json={"username": "testuser", "password": "password123"},
            )

            # Login twice
            response1 = await client.post(
                "/api/auth/login",
                json={"username": "testuser", "password": "password123"},
            )
            response2 = await client.post(
                "/api/auth/login",
                json={"username": "testuser", "password": "password123"},
            )

        token1 = response1.json()["access_token"]
        token2 = response2.json()["access_token"]
        assert token1 != token2


class TestLogout:
    """Tests for /auth/logout endpoint"""

    @pytest.mark.asyncio
    async def test_logout_invalidates_session(self, client):
        """Logout invalidates the session token"""
        async with client:
            # Create and login
            reg_response = await client.post(
                "/api/auth/register",
                json={"username": "testuser", "password": "password123"},
            )
            token = reg_response.json()["access_token"]

            # Logout
            logout_response = await client.post(
                "/api/auth/logout",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert logout_response.status_code == 200
            assert "successfully" in logout_response.json()["message"]

            # Try to use token after logout
            me_response = await client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert me_response.status_code == 401

    @pytest.mark.asyncio
    async def test_logout_without_token(self, client):
        """Logout without token returns graceful message"""
        async with client:
            response = await client.post("/api/auth/logout")

        assert response.status_code == 200
        assert "No session" in response.json()["message"]


class TestMe:
    """Tests for /auth/me endpoint"""

    @pytest.mark.asyncio
    async def test_me_returns_user_info(self, client):
        """Returns current user info when authenticated"""
        async with client:
            # Create user
            reg_response = await client.post(
                "/api/auth/register",
                json={"username": "testuser", "password": "password123"},
            )
            token = reg_response.json()["access_token"]

            # Get user info
            response = await client.get(
                "/api/auth/me",
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "testuser"
        assert data["role"] == "owner"  # First user is owner
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_me_requires_auth(self, client):
        """Returns 401 when not authenticated"""
        async with client:
            response = await client.get("/api/auth/me")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_me_invalid_token(self, client):
        """Returns 401 for invalid token"""
        async with client:
            response = await client.get(
                "/api/auth/me",
                headers={"Authorization": "Bearer invalidtoken"},
            )

        assert response.status_code == 401


class TestCreateUser:
    """Tests for /auth/users endpoint"""

    @pytest.mark.asyncio
    async def test_owner_can_create_admin(self, client):
        """Owner can create admin users"""
        async with client:
            # Create owner
            owner_response = await client.post(
                "/api/auth/register",
                json={"username": "owner", "password": "password123"},
            )
            owner_token = owner_response.json()["access_token"]

            # Create admin
            response = await client.post(
                "/api/auth/users",
                json={
                    "username": "newadmin",
                    "password": "password123",
                    "role": "admin",
                },
                headers={"Authorization": f"Bearer {owner_token}"},
            )

        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newadmin"
        assert data["role"] == "admin"

    @pytest.mark.asyncio
    async def test_admin_cannot_create_admin(self, client):
        """Admin cannot create other admins"""
        async with client:
            # Create owner
            owner_response = await client.post(
                "/api/auth/register",
                json={"username": "owner", "password": "password123"},
            )
            owner_token = owner_response.json()["access_token"]

            # Create admin
            await client.post(
                "/api/auth/users",
                json={
                    "username": "admin1",
                    "password": "password123",
                    "role": "admin",
                },
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Login as admin
            admin_login = await client.post(
                "/api/auth/login",
                json={"username": "admin1", "password": "password123"},
            )
            admin_token = admin_login.json()["access_token"]

            # Try to create another admin
            response = await client.post(
                "/api/auth/users",
                json={
                    "username": "admin2",
                    "password": "password123",
                    "role": "admin",
                },
                headers={"Authorization": f"Bearer {admin_token}"},
            )

        assert response.status_code == 403
        assert "Cannot assign role" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_admin_can_create_user(self, client):
        """Admin can create regular users"""
        async with client:
            # Create owner
            owner_response = await client.post(
                "/api/auth/register",
                json={"username": "owner", "password": "password123"},
            )
            owner_token = owner_response.json()["access_token"]

            # Create admin
            await client.post(
                "/api/auth/users",
                json={
                    "username": "admin1",
                    "password": "password123",
                    "role": "admin",
                },
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Login as admin
            admin_login = await client.post(
                "/api/auth/login",
                json={"username": "admin1", "password": "password123"},
            )
            admin_token = admin_login.json()["access_token"]

            # Create regular user
            response = await client.post(
                "/api/auth/users",
                json={
                    "username": "newuser",
                    "password": "password123",
                    "role": "user",
                },
                headers={"Authorization": f"Bearer {admin_token}"},
            )

        assert response.status_code == 201
        assert response.json()["role"] == "user"

    @pytest.mark.asyncio
    async def test_cannot_create_owner(self, client):
        """No one can create another owner"""
        async with client:
            # Create owner
            owner_response = await client.post(
                "/api/auth/register",
                json={"username": "owner", "password": "password123"},
            )
            owner_token = owner_response.json()["access_token"]

            # Try to create another owner
            response = await client.post(
                "/api/auth/users",
                json={
                    "username": "owner2",
                    "password": "password123",
                    "role": "owner",
                },
                headers={"Authorization": f"Bearer {owner_token}"},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_user_cannot_create_users(self, client):
        """Regular users cannot create other users"""
        async with client:
            # Create owner
            owner_response = await client.post(
                "/api/auth/register",
                json={"username": "owner", "password": "password123"},
            )
            owner_token = owner_response.json()["access_token"]

            # Create regular user
            await client.post(
                "/api/auth/users",
                json={
                    "username": "regularuser",
                    "password": "password123",
                    "role": "user",
                },
                headers={"Authorization": f"Bearer {owner_token}"},
            )

            # Login as regular user
            user_login = await client.post(
                "/api/auth/login",
                json={"username": "regularuser", "password": "password123"},
            )
            user_token = user_login.json()["access_token"]

            # Try to create another user
            response = await client.post(
                "/api/auth/users",
                json={
                    "username": "newuser",
                    "password": "password123",
                    "role": "user",
                },
                headers={"Authorization": f"Bearer {user_token}"},
            )

        assert response.status_code == 403
