"""Helpers for tests that run the durable execution dispatcher.

Each ``ExecutionDispatcher`` built here stands in for one Hub process: they
share the test database but nothing in memory, so several of them simulate
competing replicas and a new one simulates a restarted Hub.
"""

import asyncio
from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import patch

from app.config import settings
from app.domain.auth.tokens import InMemoryTokenStore
from app.domain.capabilities import CapabilityIssuer
from app.domain.executions.dispatcher import ExecutionDispatcher
from app.domain.workflows.store import WorkflowFileStore
from tests.conftest import TestSessionLocal


class FakeServerClient:
    """Stands in for ServerClient; counts requests and can block them."""

    instances: list["FakeServerClient"] = []
    requests: int = 0
    cancelled: int = 0
    result: object = {"duration": 1.5}
    # When set, each request waits for it before answering.
    gate: asyncio.Event | None = None

    def __init__(self, endpoint_url: str, auth_token: str | None = None) -> None:
        self.endpoint_url = endpoint_url
        self.auth_token = auth_token
        FakeServerClient.instances.append(self)

    async def execute(self, workflow_content: bytes) -> object:
        FakeServerClient.requests += 1
        try:
            if FakeServerClient.gate is not None:
                await FakeServerClient.gate.wait()
        except asyncio.CancelledError:
            FakeServerClient.cancelled += 1
            raise
        return FakeServerClient.result

    @classmethod
    def reset(cls) -> None:
        cls.instances = []
        cls.requests = 0
        cls.cancelled = 0
        cls.result = {"duration": 1.5}
        cls.gate = None


@contextmanager
def fake_server() -> Iterator[type[FakeServerClient]]:
    FakeServerClient.reset()
    with patch("app.domain.executions.dispatcher.ServerClient", FakeServerClient):
        yield FakeServerClient
    FakeServerClient.reset()


@contextmanager
def real_issuer() -> Iterator[InMemoryTokenStore]:
    store = InMemoryTokenStore()
    issuer = CapabilityIssuer(store, settings)
    with patch("app.domain.capabilities.get_issuer", lambda: issuer):
        yield store


def make_dispatcher(name: str = "hub-a", **kwargs: object) -> ExecutionDispatcher:
    return ExecutionDispatcher(
        TestSessionLocal,
        instance_id=name,
        file_store=WorkflowFileStore(settings.workflow_storage_path),
        **kwargs,  # type: ignore[arg-type]
    )


async def run_all(dispatcher: ExecutionDispatcher) -> int:
    """Claim and run everything claimable on one dispatcher; return the count."""
    total = 0
    while True:
        claims = await dispatcher.dispatch_once()
        if not claims:
            break
        total += len(claims)
        await dispatcher.wait_idle()
    return total


async def wait_for(predicate, timeout: float = 5.0) -> None:  # type: ignore[no-untyped-def]
    """Poll an async predicate until it returns truthy."""
    deadline = asyncio.get_running_loop().time() + timeout
    while not await predicate():
        if asyncio.get_running_loop().time() > deadline:
            raise AssertionError("condition not met in time")
        await asyncio.sleep(0.02)
