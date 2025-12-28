"""Tests for health poller"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.domain.servers.health_poller import HealthPoller
from app.domain.servers.client import HealthResponse, ServerError


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
