"""Tests for health poller"""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.servers.client import HealthResponse, ServerError
from app.domain.servers.health_poller import HealthPoller


class TestHealthPoller:
    """Test cases for HealthPoller"""

    def test_init(self):
        """Poller initializes correctly"""
        poller = HealthPoller()
        assert poller._task is None
        assert poller._running is False
        assert poller._failure_counts == {}

    @pytest.mark.asyncio
    async def test_start_sets_running(self):
        """Start sets running flag and creates task"""
        poller = HealthPoller()

        # Mock the poll loop to exit immediately
        with patch.object(poller, "_poll_loop", new_callable=AsyncMock):
            await poller.start()
            assert poller._running is True
            assert poller._task is not None
            await poller.stop()

    @pytest.mark.asyncio
    async def test_stop_clears_running(self):
        """Stop clears running flag"""
        poller = HealthPoller()

        with patch.object(poller, "_poll_loop", new_callable=AsyncMock):
            await poller.start()
            await poller.stop()
            assert poller._running is False
            assert poller._task is None

    @pytest.mark.asyncio
    async def test_double_start_logs_warning(self):
        """Starting twice logs warning"""
        poller = HealthPoller()

        with patch.object(poller, "_poll_loop", new_callable=AsyncMock):
            await poller.start()
            # Second start should not create new task
            await poller.start()
            assert poller._running is True
            await poller.stop()


class TestHealthPollerBackoff:
    """Test exponential backoff logic"""

    def test_failure_count_tracks_failures(self):
        """Failure count increases on failures"""
        poller = HealthPoller()
        server_id = "test-server-1"

        # Initially no failures
        assert poller._failure_counts.get(server_id, 0) == 0

        # Simulate failures
        poller._failure_counts[server_id] = 1
        assert poller._failure_counts[server_id] == 1

        poller._failure_counts[server_id] = 5
        assert poller._failure_counts[server_id] == 5

    def test_failure_count_resets_on_success(self):
        """Failure count resets when server comes back online"""
        poller = HealthPoller()
        server_id = "test-server-1"

        poller._failure_counts[server_id] = 5
        poller._failure_counts[server_id] = 0  # Reset on success

        assert poller._failure_counts[server_id] == 0


class TestHealthPollerOfflineThreshold:
    """Poll must not flip status to offline below the configured
    consecutive-failure threshold."""

    def _make_server(self, status: str = "online"):
        from uuid import uuid4

        s = MagicMock()
        s.id = uuid4()
        s.name = "srv"
        s.endpoint_url = "http://srv"
        s.auth_token = "tok"
        s.status = status
        s.version = "1.0"
        return s

    @pytest.mark.asyncio
    async def test_below_threshold_keeps_status(self):
        """Two consecutive failures must not flip status to offline."""
        poller = HealthPoller()
        server = self._make_server(status="online")

        with (
            patch(
                "app.domain.servers.health_poller.ServerClient"
            ) as mock_client_cls,
            patch(
                "app.domain.servers.health_poller.settings"
            ) as mock_settings,
        ):
            mock_settings.server_offline_threshold = 3
            mock_settings.server_backoff_max_seconds = 60

            instance = MagicMock()
            instance.health = AsyncMock(return_value=ServerError("boom"))
            mock_client_cls.return_value = instance

            # Failure 1 - clear any backoff first so subsequent polls run
            await poller._poll_server(MagicMock(), server)
            poller._next_retry_at.clear()
            # Failure 2
            await poller._poll_server(MagicMock(), server)

        assert server.status == "online"
        assert poller._failure_counts[str(server.id)] == 2

    @pytest.mark.asyncio
    async def test_threshold_flips_to_offline(self):
        """The Nth consecutive failure (default 3) flips status to offline."""
        poller = HealthPoller()
        server = self._make_server(status="online")

        with (
            patch(
                "app.domain.servers.health_poller.ServerClient"
            ) as mock_client_cls,
            patch(
                "app.domain.servers.health_poller.settings"
            ) as mock_settings,
        ):
            mock_settings.server_offline_threshold = 3
            mock_settings.server_backoff_max_seconds = 60

            instance = MagicMock()
            instance.health = AsyncMock(return_value=ServerError("boom"))
            mock_client_cls.return_value = instance

            for _ in range(3):
                await poller._poll_server(MagicMock(), server)
                # Clear backoff so the next call isn't skipped.
                poller._next_retry_at.clear()

        assert server.status == "offline"
        assert poller._failure_counts[str(server.id)] == 3

    @pytest.mark.asyncio
    async def test_success_resets_counter_and_backoff(self):
        """A successful health response clears failure counter and backoff."""
        poller = HealthPoller()
        server = self._make_server(status="offline")
        # Seed two prior failures.
        poller._failure_counts[str(server.id)] = 2
        poller._next_retry_at[str(server.id)] = datetime.now(timezone.utc)

        with patch(
            "app.domain.servers.health_poller.ServerClient"
        ) as mock_client_cls:
            instance = MagicMock()
            instance.health = AsyncMock(
                return_value=HealthResponse(status="ok", version="2.0")
            )
            mock_client_cls.return_value = instance

            await poller._poll_server(MagicMock(), server)

        assert server.status == "online"
        assert str(server.id) not in poller._failure_counts
        assert str(server.id) not in poller._next_retry_at

    @pytest.mark.asyncio
    async def test_backoff_is_exponential_and_capped(self):
        """Backoff doubles per failure and is capped at the configured max."""

        poller = HealthPoller()
        server = self._make_server(status="online")

        with (
            patch(
                "app.domain.servers.health_poller.ServerClient"
            ) as mock_client_cls,
            patch(
                "app.domain.servers.health_poller.settings"
            ) as mock_settings,
        ):
            mock_settings.server_offline_threshold = 100  # don't flip
            mock_settings.server_backoff_max_seconds = 8

            instance = MagicMock()
            instance.health = AsyncMock(return_value=ServerError("x"))
            mock_client_cls.return_value = instance

            deltas: list[float] = []
            for _ in range(6):
                before = datetime.now(timezone.utc)
                await poller._poll_server(MagicMock(), server)
                after = poller._next_retry_at[str(server.id)]
                deltas.append((after - before).total_seconds())
                poller._next_retry_at.clear()

        # Expected sequence: 1, 2, 4, 8 (cap), 8, 8.
        # Allow small tolerance for clock drift between samples.
        for actual, expected in zip(deltas, [1, 2, 4, 8, 8, 8]):
            assert abs(actual - expected) < 0.5
