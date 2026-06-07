"""Tests for session management"""

import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.auth.sessions import (
    SessionInfo,
    SessionManager,
    generate_session_token,
    hash_token,
)


class TestGenerateSessionToken:
    """Tests for session token generation"""

    def test_generates_string(self):
        """Token should be a string"""
        token = generate_session_token()
        assert isinstance(token, str)

    def test_sufficient_length(self):
        """Token should have sufficient entropy (at least 32 chars)"""
        token = generate_session_token()
        assert len(token) >= 32

    def test_unique_tokens(self):
        """Each call should generate a unique token"""
        tokens = {generate_session_token() for _ in range(100)}
        assert len(tokens) == 100

    def test_url_safe(self):
        """Token should be URL-safe (no special chars needing encoding)"""
        token = generate_session_token()
        # URL-safe base64 uses only alphanumeric, - and _
        import re
        assert re.match(r'^[A-Za-z0-9_-]+$', token)


class TestHashToken:
    """Tests for token hashing"""

    def test_returns_hex_string(self):
        """Hash should be a hex string"""
        hashed = hash_token("testtoken")
        assert isinstance(hashed, str)
        # SHA-256 produces 64 hex characters
        assert len(hashed) == 64
        assert all(c in '0123456789abcdef' for c in hashed)

    def test_deterministic(self):
        """Same token should produce same hash"""
        token = "testtoken"
        assert hash_token(token) == hash_token(token)

    def test_different_tokens_different_hashes(self):
        """Different tokens should produce different hashes"""
        assert hash_token("token1") != hash_token("token2")


class TestSessionManager:
    """Tests for SessionManager class"""

    @pytest.fixture
    def mock_db(self):
        """Create a mock database session"""
        db = AsyncMock()
        db.add = MagicMock()
        db.commit = AsyncMock()
        db.execute = AsyncMock()
        return db

    @pytest.fixture
    def mock_user(self):
        """Create a mock user"""
        user = MagicMock()
        user.id = uuid.uuid4()
        user.username = "testuser"
        user.role = "user"
        return user

    @pytest.fixture
    def session_manager(self, mock_db):
        """Create a SessionManager with mock db"""
        return SessionManager(mock_db)

    @pytest.mark.asyncio
    async def test_create_session_returns_token(self, session_manager, mock_user):
        """create_session should return a token string"""
        token = await session_manager.create_session(mock_user)
        assert isinstance(token, str)
        assert len(token) >= 32

    @pytest.mark.asyncio
    async def test_create_session_adds_to_db(self, session_manager, mock_user, mock_db):
        """create_session should add session to database"""
        await session_manager.create_session(mock_user)
        mock_db.add.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_session_stores_hash_not_plaintext(
        self, session_manager, mock_user, mock_db
    ):
        """Session should store hashed token, not plaintext"""
        token = await session_manager.create_session(mock_user)

        # Get the session object that was added
        added_session = mock_db.add.call_args[0][0]

        # Hash should not equal plaintext
        assert added_session.token_hash != token
        # Hash should match our hash function
        assert added_session.token_hash == hash_token(token)

    @pytest.mark.asyncio
    async def test_create_session_captures_metadata(
        self, session_manager, mock_user, mock_db
    ):
        """Session should capture user_agent and ip_address"""
        await session_manager.create_session(
            mock_user,
            user_agent="Mozilla/5.0",
            ip_address="192.168.1.1",
        )

        added_session = mock_db.add.call_args[0][0]
        assert added_session.user_agent == "Mozilla/5.0"
        assert added_session.ip_address == "192.168.1.1"

    @pytest.mark.asyncio
    async def test_create_session_sets_expiry(
        self, session_manager, mock_user, mock_db
    ):
        """Session should have appropriate expiry time"""
        with patch('app.domain.auth.sessions.settings') as mock_settings:
            mock_settings.session_lifetime_hours = 24

            await session_manager.create_session(mock_user)

            added_session = mock_db.add.call_args[0][0]
            # Expiry should be roughly 24 hours from now
            expected_expiry = datetime.now(UTC) + timedelta(hours=24)
            # Allow 1 minute tolerance for test execution time
            assert abs((added_session.expires_at - expected_expiry).total_seconds()) < 60

    @pytest.mark.asyncio
    async def test_create_session_custom_lifetime(
        self, session_manager, mock_user, mock_db
    ):
        """Session should respect custom lifetime parameter"""
        await session_manager.create_session(mock_user, lifetime_hours=1)

        added_session = mock_db.add.call_args[0][0]
        expected_expiry = datetime.now(UTC) + timedelta(hours=1)
        assert abs((added_session.expires_at - expected_expiry).total_seconds()) < 60

    @pytest.mark.asyncio
    async def test_validate_session_returns_none_for_invalid(
        self, session_manager, mock_db
    ):
        """validate_session should return None for invalid token"""
        # Set up mock to return empty result
        mock_result = MagicMock()
        mock_result.first.return_value = None
        mock_db.execute.return_value = mock_result

        result = await session_manager.validate_session("invalidtoken")
        assert result is None

    @pytest.mark.asyncio
    async def test_validate_session_returns_session_info(
        self, session_manager, mock_user, mock_db
    ):
        """validate_session should return SessionInfo for valid token"""
        # Create mock session and user
        mock_session = MagicMock()
        mock_session.id = uuid.uuid4()
        mock_session.created_at = datetime.now(UTC)
        mock_session.expires_at = datetime.now(UTC) + timedelta(hours=24)
        mock_session.last_used_at = None

        # Set up mock to return result with indexable row
        mock_row = MagicMock()
        mock_row.__getitem__ = lambda self, idx: mock_session if idx == 0 else mock_user
        mock_result = MagicMock()
        mock_result.first.return_value = mock_row
        mock_db.execute.return_value = mock_result

        result = await session_manager.validate_session("validtoken")

        assert isinstance(result, SessionInfo)
        assert result.user_id == mock_user.id
        assert result.username == mock_user.username
        assert result.role == mock_user.role

    @pytest.mark.asyncio
    async def test_invalidate_session_deletes_from_db(
        self, session_manager, mock_db
    ):
        """invalidate_session should delete session from database"""
        mock_result = MagicMock()
        mock_result.rowcount = 1
        mock_db.execute.return_value = mock_result

        result = await session_manager.invalidate_session("sometoken")

        assert result is True
        mock_db.execute.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_invalidate_session_returns_false_if_not_found(
        self, session_manager, mock_db
    ):
        """invalidate_session should return False if session not found"""
        mock_result = MagicMock()
        mock_result.rowcount = 0
        mock_db.execute.return_value = mock_result

        result = await session_manager.invalidate_session("nonexistenttoken")

        assert result is False

    @pytest.mark.asyncio
    async def test_invalidate_all_user_sessions(
        self, session_manager, mock_db
    ):
        """invalidate_all_user_sessions should delete all user sessions"""
        mock_result = MagicMock()
        mock_result.rowcount = 3
        mock_db.execute.return_value = mock_result
        user_id = uuid.uuid4()

        count = await session_manager.invalidate_all_user_sessions(user_id)

        assert count == 3
        mock_db.execute.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_cleanup_expired_sessions(
        self, session_manager, mock_db
    ):
        """cleanup_expired_sessions should delete expired sessions"""
        mock_result = MagicMock()
        mock_result.rowcount = 5
        mock_db.execute.return_value = mock_result

        count = await session_manager.cleanup_expired_sessions()

        assert count == 5
        mock_db.execute.assert_called_once()
        mock_db.commit.assert_called_once()

    @pytest.mark.asyncio
    async def test_cleanup_expired_sessions_batched(
        self, session_manager, mock_db
    ):
        """batch_size kwarg should issue a bounded subquery-based DELETE.

        We can't introspect the rendered SQL trivially from a MagicMock,
        but we can assert the manager honours the kwarg signature, runs
        a single DELETE per call, and returns the result row count.
        """
        mock_result = MagicMock()
        mock_result.rowcount = 1000
        mock_db.execute.return_value = mock_result

        count = await session_manager.cleanup_expired_sessions(batch_size=1000)

        assert count == 1000
        assert mock_db.execute.call_count == 1
        mock_db.commit.assert_called_once()


class TestSessionCleanupLoop:
    """Tests for the periodic session-cleanup background task."""

    @pytest.mark.asyncio
    async def test_loop_invokes_cleanup_each_interval(self):
        """The loop sleeps for the configured interval then runs cleanup."""
        import asyncio

        from app import main as main_module

        sleep_calls: list[float] = []
        cleanup_calls: list[int | None] = []
        # First sleep returns normally so we run the body once; the second
        # raises CancelledError so the loop exits cleanly.
        sleep_side_effects = iter([None, asyncio.CancelledError()])

        async def fake_sleep(seconds):
            sleep_calls.append(seconds)
            result = next(sleep_side_effects)
            if isinstance(result, BaseException):
                raise result
            return result

        class FakeManager:
            def __init__(self, _db):
                pass

            async def cleanup_expired_sessions(self, batch_size=None):
                cleanup_calls.append(batch_size)
                return 0

        class FakeCtx:
            async def __aenter__(self):
                return MagicMock()

            async def __aexit__(self, *exc):
                return False

        with (
            patch("asyncio.sleep", fake_sleep),
            patch.object(main_module, "SessionManager", FakeManager),
            patch.object(
                main_module, "async_session_maker", lambda: FakeCtx()
            ),
            patch.object(
                main_module.settings, "session_cleanup_batch_size", 250
            ),
            patch.object(main_module, "SESSION_CLEANUP_INTERVAL", 42),
        ):
            await main_module._session_cleanup_loop()

        assert sleep_calls[0] == 42
        assert cleanup_calls == [250]

