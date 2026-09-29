"""Tests for the Hub heartbeat manager (Server self-registration)."""

import asyncio
from typing import Any

import pytest

from app.config import settings
from app.domain.hub import heartbeat as hb
from app.domain.hub.heartbeat import HeartbeatManager, create_heartbeat_manager


class FakeHubClient:
    """Stands in for HubClient.register with a scripted sequence of outcomes."""

    def __init__(self, outcomes: list[Any] | None = None) -> None:
        self.outcomes = list(outcomes or [])
        self.calls: list[dict[str, Any]] = []
        self.default: Any = {"id": "srv"}

    async def register(self, **kwargs: Any) -> dict[str, Any] | None:
        self.calls.append(kwargs)
        outcome = self.outcomes.pop(0) if self.outcomes else self.default
        if isinstance(outcome, BaseException):
            raise outcome
        assert outcome is None or isinstance(outcome, dict)
        return outcome


@pytest.fixture(autouse=True)
def hub_settings(monkeypatch):
    monkeypatch.setattr(settings, "hub_url", "http://hub.test")
    monkeypatch.setattr(settings, "hub_server_token", "srv-token")
    monkeypatch.setattr(settings, "hub_registration_secret", "")


def make_manager(client: FakeHubClient | None = None, **kwargs: Any) -> HeartbeatManager:
    manager = HeartbeatManager(server_name="dev", endpoint_url="http://localhost:25811", **kwargs)
    if client is not None:
        setattr(manager, "hub_client", client)
    return manager


class TestConstruction:
    def test_creates_hub_client_from_settings(self):
        assert make_manager().hub_client is not None

    def test_missing_hub_settings_leave_no_client(self, monkeypatch):
        monkeypatch.setattr(settings, "hub_url", "")
        assert make_manager().hub_client is None


class TestRegister:
    async def test_first_success_marks_registered(self):
        client = FakeHubClient()
        manager = make_manager(client)

        await manager._register()

        assert manager._registered is True
        assert client.calls == [
            {
                "name": "dev",
                "endpoint_url": "http://localhost:25811",
                "registration_secret": None,
            }
        ]

    async def test_registration_secret_is_forwarded(self, monkeypatch):
        monkeypatch.setattr(settings, "hub_registration_secret", "s3cret")
        client = FakeHubClient()
        manager = make_manager(client)

        await manager._register()

        assert client.calls[0]["registration_secret"] == "s3cret"

    async def test_failure_before_first_success_stays_unregistered(self):
        manager = make_manager(FakeHubClient([None]))
        await manager._register()
        assert manager._registered is False

    async def test_lost_hub_flips_back_to_unregistered_and_recovers(self):
        client = FakeHubClient([{"id": "srv"}, None, {"id": "srv"}])
        manager = make_manager(client)

        await manager._register()
        assert manager._registered is True
        await manager._register()
        assert manager._registered is False
        await manager._register()
        assert manager._registered is True

    async def test_exception_is_swallowed_and_marks_unregistered(self):
        manager = make_manager(FakeHubClient([RuntimeError("boom")]))
        manager._registered = True

        await manager._register()  # must not raise

        assert manager._registered is False

    async def test_exception_during_startup_window_is_quiet(self, caplog):
        manager = make_manager(FakeHubClient([ConnectionError("hub starting")]))
        manager._initial_registration_attempts = 1

        with caplog.at_level("DEBUG", logger=hb.logger.name):
            await manager._register()

        assert not [r for r in caplog.records if r.levelname == "ERROR"]

    async def test_exception_after_startup_window_is_logged_as_error(self, caplog):
        manager = make_manager(FakeHubClient([ConnectionError("hub gone")]), max_initial_retries=2)
        manager._initial_registration_attempts = 2

        with caplog.at_level("DEBUG", logger=hb.logger.name):
            await manager._register()

        assert [r for r in caplog.records if r.levelname == "ERROR"]

    async def test_no_client_is_a_noop(self, monkeypatch):
        monkeypatch.setattr(settings, "hub_url", "")
        manager = make_manager()
        await manager._register()
        assert manager._registered is False


class TestStartStop:
    async def test_start_registers_immediately_and_stop_cancels_loop(self):
        client = FakeHubClient()
        manager = make_manager(client, interval_seconds=3600, initial_retry_interval=3600)

        await manager.start()
        try:
            assert manager._registered is True
            assert len(client.calls) == 1
            assert manager._task is not None
            assert not manager._task.done()
        finally:
            await manager.stop()

        assert manager._task is None
        assert manager._running is False

    async def test_start_twice_does_not_spawn_a_second_loop(self):
        manager = make_manager(FakeHubClient(), interval_seconds=3600, initial_retry_interval=3600)
        await manager.start()
        try:
            first_task = manager._task
            await manager.start()
            assert manager._task is first_task
        finally:
            await manager.stop()

    async def test_start_without_client_does_nothing(self, monkeypatch):
        monkeypatch.setattr(settings, "hub_url", "")
        manager = make_manager()
        await manager.start()
        assert manager._task is None
        assert manager._running is False

    async def test_stop_without_start_is_safe(self):
        await make_manager(FakeHubClient()).stop()

    async def test_stop_can_be_called_twice(self):
        manager = make_manager(FakeHubClient(), interval_seconds=3600, initial_retry_interval=3600)
        await manager.start()
        await manager.stop()
        await manager.stop()


class TestHeartbeatLoop:
    async def test_loop_re_registers_periodically(self):
        client = FakeHubClient()
        manager = make_manager(client, interval_seconds=0, initial_retry_interval=0)

        await manager.start()
        try:
            for _ in range(200):
                if len(client.calls) >= 4:
                    break
                await asyncio.sleep(0.005)
        finally:
            await manager.stop()

        assert len(client.calls) >= 4

    async def test_loop_reconnects_after_hub_restart(self):
        # Registered, Hub goes away for two beats, Hub comes back
        client = FakeHubClient([{"id": "srv"}, None, RuntimeError("hub down"), {"id": "srv"}])
        manager = make_manager(client, interval_seconds=0, initial_retry_interval=0)

        await manager.start()
        try:
            for _ in range(400):
                if len(client.calls) >= 5 and manager._registered:
                    break
                await asyncio.sleep(0.005)
        finally:
            await manager.stop()

        assert len(client.calls) >= 4
        assert manager._registered is True

    async def test_loop_survives_unexpected_errors(self, monkeypatch):
        manager = make_manager(FakeHubClient(), interval_seconds=0, initial_retry_interval=0)
        attempts = 0

        async def flaky() -> None:
            nonlocal attempts
            attempts += 1
            if attempts == 2:
                raise ValueError("unexpected")

        monkeypatch.setattr(manager, "_register", flaky)
        manager._running = True
        task = asyncio.create_task(manager._heartbeat_loop())
        try:
            for _ in range(400):
                if attempts >= 4:
                    break
                await asyncio.sleep(0.005)
        finally:
            manager._running = False
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task

        assert attempts >= 4

    async def test_uses_fast_retry_interval_until_registered(self, monkeypatch):
        sleeps: list[float] = []
        real_sleep = asyncio.sleep

        async def record_sleep(delay: float) -> None:
            sleeps.append(delay)
            await real_sleep(0)

        monkeypatch.setattr(hb.asyncio, "sleep", record_sleep)
        client = FakeHubClient([None, None, {"id": "srv"}])
        manager = make_manager(client, interval_seconds=30, initial_retry_interval=5)
        manager._running = True
        manager._registered = False

        task = asyncio.create_task(manager._heartbeat_loop())
        for _ in range(200):
            if len(client.calls) >= 5:
                break
            await real_sleep(0.001)
        manager._running = False
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task

        # Fast interval while unregistered, normal interval once registered
        assert sleeps[0] == 5
        assert 30 in sleeps
        assert sleeps.index(30) > 0


class TestCreateHeartbeatManager:
    @pytest.fixture(autouse=True)
    def _reset_global(self, monkeypatch):
        monkeypatch.setattr(hb, "_heartbeat_manager", None)

    def test_none_outside_hub_mode(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "disabled")
        assert create_heartbeat_manager() is None
        assert hb.get_heartbeat_manager() is None

    def test_none_when_hub_not_configured(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(settings, "hub_server_token", "")
        assert create_heartbeat_manager() is None

    def test_defaults_derive_from_settings(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(settings, "port", 25811)
        monkeypatch.setattr(settings, "host", "0.0.0.0")

        manager = create_heartbeat_manager()

        assert manager is not None
        assert manager.server_name == "server-25811"
        # A bind-all address is not reachable by Hub; advertise localhost
        assert manager.endpoint_url == "http://localhost:25811"
        assert hb.get_heartbeat_manager() is manager

    def test_explicit_host_is_advertised(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "hub")
        monkeypatch.setattr(settings, "port", 9000)
        monkeypatch.setattr(settings, "host", "srv.example.com")

        manager = create_heartbeat_manager()

        assert manager is not None
        assert manager.endpoint_url == "http://srv.example.com:9000"

    def test_explicit_name_and_endpoint_win(self, monkeypatch):
        monkeypatch.setattr(settings, "auth_mode", "hub")

        manager = create_heartbeat_manager(server_name="prod-1", endpoint_url="https://s.example")

        assert manager is not None
        assert (manager.server_name, manager.endpoint_url) == ("prod-1", "https://s.example")
