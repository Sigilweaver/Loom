"""Cookie sessions and CSRF protection for the Hub web app (issue #118).

The web app signs in with ``session_mode='cookie'``: the session token travels
only in an HttpOnly cookie, and every state-changing request authenticated by
that cookie must carry the matching ``X-CSRF-Token``. Bearer clients (Studio,
scripts) are unaffected.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.domain.auth.cookies import CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE, csrf_token_for
from app.main import app


def https_client() -> AsyncClient:
    """A client on https, so Secure cookies are stored and sent like a browser."""
    return AsyncClient(transport=ASGITransport(app=app), base_url="https://hub.test")


async def register_owner(client: AsyncClient, mode: str = "cookie"):
    return await client.post(
        "/api/v1/auth/register",
        json={"username": "owner", "password": "password123", "session_mode": mode},
    )


def set_cookie_headers(response) -> list[str]:
    return response.headers.get_list("set-cookie")


def cookie_header(response, name: str) -> str:
    matches = [h for h in set_cookie_headers(response) if h.startswith(f"{name}=")]
    assert matches, f"{name} cookie was not set"
    return matches[0]


@pytest.fixture
def cookie_client(setup_database):
    return https_client()


class TestCookieLogin:
    @pytest.mark.asyncio
    async def test_cookie_login_sets_httponly_session_and_returns_no_token(self, cookie_client):
        async with cookie_client as client:
            await register_owner(client, mode="bearer")
            response = await client.post(
                "/api/v1/auth/login",
                json={"username": "owner", "password": "password123", "session_mode": "cookie"},
            )

        assert response.status_code == 200
        body = response.json()
        assert body["access_token"] is None
        assert body["token_type"] == "cookie"
        assert body["user"]["username"] == "owner"

        session = cookie_header(response, SESSION_COOKIE).lower()
        assert "httponly" in session
        assert "secure" in session
        assert "samesite=strict" in session
        assert "path=/api" in session

        csrf = cookie_header(response, CSRF_COOKIE).lower()
        assert "httponly" not in csrf
        assert "secure" in csrf
        assert "samesite=strict" in csrf

    @pytest.mark.asyncio
    async def test_first_run_registration_can_use_cookies(self, cookie_client):
        async with cookie_client as client:
            response = await register_owner(client)
            me = await client.get("/api/v1/auth/me")

        assert response.status_code == 201
        assert response.json()["access_token"] is None
        assert me.status_code == 200
        assert me.json()["username"] == "owner"

    @pytest.mark.asyncio
    async def test_bearer_login_is_unchanged_and_sets_no_cookies(self, cookie_client):
        async with cookie_client as client:
            response = await register_owner(client, mode="bearer")

        assert response.json()["access_token"]
        assert response.json()["token_type"] == "bearer"
        assert set_cookie_headers(response) == []

    @pytest.mark.asyncio
    async def test_csrf_cookie_is_bound_to_the_session(self, cookie_client):
        async with cookie_client as client:
            await register_owner(client)
            session_token = client.cookies.get(SESSION_COOKIE)
            csrf = client.cookies.get(CSRF_COOKIE)

        assert session_token and csrf
        assert csrf == csrf_token_for(session_token)
        assert csrf != session_token

    @pytest.mark.asyncio
    async def test_secure_flag_follows_the_setting(self, cookie_client, monkeypatch):
        monkeypatch.setattr(settings, "session_cookie_secure", False)
        async with cookie_client as client:
            response = await register_owner(client)

        assert "secure" not in cookie_header(response, SESSION_COOKIE).lower()


class TestCsrf:
    @pytest.mark.asyncio
    async def test_safe_requests_need_no_csrf_token(self, cookie_client):
        async with cookie_client as client:
            await register_owner(client)
            response = await client.get("/api/v1/users")

        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_unsafe_cookie_request_without_csrf_is_rejected(self, cookie_client):
        async with cookie_client as client:
            await register_owner(client)
            response = await client.post(
                "/api/v1/users",
                json={"username": "victim", "password": "password123", "role": "admin"},
            )
            users = await client.get("/api/v1/users")

        assert response.status_code == 403
        assert "CSRF" in response.json()["detail"]
        assert all(u["username"] != "victim" for u in users.json()["users"])

    @pytest.mark.asyncio
    async def test_wrong_csrf_token_is_rejected(self, cookie_client):
        async with cookie_client as client:
            await register_owner(client)
            response = await client.post(
                "/api/v1/users",
                json={"username": "victim", "password": "password123", "role": "user"},
                headers={CSRF_HEADER: csrf_token_for("some-other-session")},
            )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_unsafe_cookie_request_with_csrf_succeeds(self, cookie_client):
        async with cookie_client as client:
            await register_owner(client)
            response = await client.post(
                "/api/v1/users",
                json={"username": "newuser", "password": "password123", "role": "user"},
                headers={CSRF_HEADER: client.cookies.get(CSRF_COOKIE)},
            )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_bearer_requests_need_no_csrf_token(self, cookie_client):
        async with cookie_client as client:
            token = (await register_owner(client, mode="bearer")).json()["access_token"]
            response = await client.post(
                "/api/v1/users",
                json={"username": "newuser", "password": "password123", "role": "user"},
                headers={"Authorization": f"Bearer {token}"},
            )

        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_login_rejects_a_form_encoded_body(self, cookie_client):
        """A cross-site HTML form cannot send JSON, so it cannot sign a victim in."""
        async with cookie_client as client:
            await register_owner(client, mode="bearer")
            response = await client.post(
                "/api/v1/auth/login",
                content=(
                    '{"username": "owner", "password": "password123", "session_mode": "cookie"}'
                ),
                headers={"Content-Type": "text/plain"},
            )

        assert response.status_code == 422
        assert SESSION_COOKIE not in client.cookies


class TestCookieLogout:
    @pytest.mark.asyncio
    async def test_logout_requires_csrf(self, cookie_client):
        async with cookie_client as client:
            await register_owner(client)
            response = await client.post("/api/v1/auth/logout")
            still_signed_in = await client.get("/api/v1/auth/me")

        assert response.status_code == 403
        assert still_signed_in.status_code == 200

    @pytest.mark.asyncio
    async def test_logout_invalidates_the_session_and_clears_cookies(self, cookie_client):
        async with cookie_client as client:
            await register_owner(client)
            session_token = client.cookies.get(SESSION_COOKIE)
            response = await client.post(
                "/api/v1/auth/logout",
                headers={CSRF_HEADER: client.cookies.get(CSRF_COOKIE)},
            )
            after = await client.get("/api/v1/auth/me")
            # Replaying the old cookie value must not work either.
            replay = await client.get(
                "/api/v1/auth/me", headers={"Cookie": f"{SESSION_COOKIE}={session_token}"}
            )

        assert response.status_code == 200
        assert response.json()["message"] == "Logged out successfully"
        cleared = [h.lower() for h in set_cookie_headers(response)]
        assert any(h.startswith(f"{SESSION_COOKIE}=") and "max-age=0" in h for h in cleared)
        assert any(h.startswith(f"{CSRF_COOKIE}=") and "max-age=0" in h for h in cleared)
        assert after.status_code == 401
        assert replay.status_code == 401


class TestSessionsEndOnPasswordChange:
    """Changing a password signs out the other holders of the account."""

    @pytest.mark.asyncio
    async def test_own_password_change_ends_other_sessions_only(self, cookie_client):
        async with cookie_client as client:
            first = (await register_owner(client, mode="bearer")).json()["access_token"]
            login = await client.post(
                "/api/v1/auth/login", json={"username": "owner", "password": "password123"}
            )
            second = login.json()["access_token"]

            change = await client.patch(
                "/api/v1/auth/me",
                json={"current_password": "password123", "new_password": "password456"},
                headers={"Authorization": f"Bearer {first}"},
            )
            me_first = await client.get(
                "/api/v1/auth/me", headers={"Authorization": f"Bearer {first}"}
            )
            me_second = await client.get(
                "/api/v1/auth/me", headers={"Authorization": f"Bearer {second}"}
            )

        assert change.status_code == 200
        assert me_first.status_code == 200
        assert me_second.status_code == 401

    @pytest.mark.asyncio
    async def test_admin_password_reset_ends_the_users_sessions(self, cookie_client):
        async with cookie_client as client:
            owner = (await register_owner(client, mode="bearer")).json()["access_token"]
            owner_headers = {"Authorization": f"Bearer {owner}"}
            created = await client.post(
                "/api/v1/users",
                json={"username": "alice", "password": "password123", "role": "user"},
                headers=owner_headers,
            )
            alice = (
                await client.post(
                    "/api/v1/auth/login", json={"username": "alice", "password": "password123"}
                )
            ).json()["access_token"]

            reset = await client.patch(
                f"/api/v1/users/{created.json()['id']}",
                json={"password": "password789"},
                headers=owner_headers,
            )
            alice_me = await client.get(
                "/api/v1/auth/me", headers={"Authorization": f"Bearer {alice}"}
            )
            owner_me = await client.get("/api/v1/auth/me", headers=owner_headers)

        assert reset.status_code == 200
        assert alice_me.status_code == 401
        assert owner_me.status_code == 200

    @pytest.mark.asyncio
    async def test_unknown_username_still_runs_a_password_check(self, cookie_client, monkeypatch):
        import app.api.v1.routes.auth as auth_routes

        calls: list[str] = []
        monkeypatch.setattr(auth_routes, "burn_password_check", calls.append)
        async with cookie_client as client:
            response = await client.post(
                "/api/v1/auth/login", json={"username": "nobody", "password": "guess-123"}
            )

        assert response.status_code == 401
        assert calls == ["guess-123"]
