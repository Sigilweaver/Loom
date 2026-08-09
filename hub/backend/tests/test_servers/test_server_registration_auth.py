"""Tests for POST /servers auth (Loom#66).

Covers both callers of the registration endpoint:
- Machine self-registration via X-Registration-Secret.
- The admin "Add Server" GUI form via an authenticated session.

The key regression this guards against: previously, if
server_registration_secret wasn't configured, POST /servers was completely
unauthenticated.
"""

import pytest

from app.config import settings
from tests.conftest import new_client


@pytest.fixture(autouse=True)
def _clear_registration_secret():
    """Ensure a clean secret setting for each test, restored afterward."""
    original = settings.server_registration_secret
    settings.server_registration_secret = ""
    yield
    settings.server_registration_secret = original


def _payload(name: str = "New Server") -> dict:
    return {
        "name": name,
        "endpoint_url": "http://localhost:25811",
        "auth_token": "test-token",
    }


class TestUnauthenticatedRegistrationIsRejected:
    @pytest.mark.asyncio
    async def test_no_session_no_secret_configured_is_rejected(self):
        """Without an admin session or a configured secret, registration fails closed."""
        async with new_client() as client:
            response = await client.post("/api/v1/servers", json=_payload())

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_no_session_secret_configured_but_missing_header_is_rejected(self):
        settings.server_registration_secret = "correct-secret"

        async with new_client() as client:
            response = await client.post("/api/v1/servers", json=_payload())

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_no_session_wrong_secret_is_rejected(self):
        settings.server_registration_secret = "correct-secret"

        async with new_client() as client:
            response = await client.post(
                "/api/v1/servers",
                json=_payload(),
                headers={"X-Registration-Secret": "wrong-secret"},
            )

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_non_admin_session_without_secret_is_rejected(self, user_headers):
        """A logged-in but non-admin user can't register a server either."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/servers", json=_payload(), headers=user_headers
            )

        assert response.status_code == 401


class TestMachineRegistrationViaSecret:
    @pytest.mark.asyncio
    async def test_valid_secret_registers_server_as_system(self):
        settings.server_registration_secret = "correct-secret"

        async with new_client() as client:
            response = await client.post(
                "/api/v1/servers",
                json=_payload("Machine Server"),
                headers={"X-Registration-Secret": "correct-secret"},
            )

        assert response.status_code == 201


class TestAdminSessionRegistration:
    @pytest.mark.asyncio
    async def test_owner_session_registers_server_without_secret(self, owner_headers):
        async with new_client() as client:
            response = await client.post(
                "/api/v1/servers", json=_payload("Owner Added Server"), headers=owner_headers
            )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_admin_session_registers_server_without_secret(self, admin_headers):
        async with new_client() as client:
            response = await client.post(
                "/api/v1/servers", json=_payload("Admin Added Server"), headers=admin_headers
            )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_auditor_session_alone_is_not_sufficient(self, auditor_headers):
        """Auditor is below Admin, so it falls through to the secret check and fails."""
        async with new_client() as client:
            response = await client.post(
                "/api/v1/servers", json=_payload(), headers=auditor_headers
            )

        assert response.status_code == 401
