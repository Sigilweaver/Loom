"""In-process pub/sub broker for live execution status updates (B6).

Single-node only: publishers (execution background tasks) and subscribers (SSE
endpoints) share one process and one event loop. Each execution status
transition is published as a JSON-serializable event dict. SSE endpoints
subscribe to either a single execution's topic or the global feed.

This is deliberately memory-only and best-effort. It is not a durable queue: a
client that connects mid-execution gets a fresh snapshot from the database and
then live deltas, so dropped events under backpressure are tolerable.
"""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from contextlib import contextmanager
from typing import Any, Iterator

logger = logging.getLogger(__name__)

# Topic used by subscribers that want every execution event (the dashboard).
GLOBAL_TOPIC = "*"

# Per-subscriber queue depth. Status events are cumulative snapshots, so if a
# slow consumer falls behind we drop the oldest rather than block the publisher.
_QUEUE_MAXSIZE = 256


class ExecutionBroker:
    """Fan-out broker delivering execution events to in-process subscribers."""

    def __init__(self) -> None:
        self._topics: dict[str, set[asyncio.Queue[dict[str, Any]]]] = defaultdict(set)

    def publish(self, event: dict[str, Any]) -> None:
        """Deliver an event to the execution's topic and the global feed.

        Non-blocking by design: this is called from execution background tasks
        and must never await or stall on a slow consumer. When a subscriber's
        queue is full the oldest event is evicted to make room.

        Args:
            event: A JSON-serializable execution snapshot. Must include an
                ``id`` field identifying the execution.
        """
        execution_id = str(event.get("id", ""))

        targets: set[asyncio.Queue[dict[str, Any]]] = set()
        if execution_id:
            targets |= self._topics.get(execution_id, set())
        targets |= self._topics.get(GLOBAL_TOPIC, set())

        for queue in targets:
            self._offer(queue, event)

    @staticmethod
    def _offer(queue: asyncio.Queue[dict[str, Any]], event: dict[str, Any]) -> None:
        """Enqueue an event without blocking, evicting the oldest if full."""
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                # Another producer refilled it in the meantime; drop this event.
                pass

    @contextmanager
    def subscribe(self, topic: str) -> Iterator[asyncio.Queue[dict[str, Any]]]:
        """Subscribe to a topic for the duration of the context.

        Args:
            topic: An execution id, or :data:`GLOBAL_TOPIC` for all events.

        Yields:
            An ``asyncio.Queue`` that receives published events.
        """
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=_QUEUE_MAXSIZE)
        self._topics[topic].add(queue)
        try:
            yield queue
        finally:
            subscribers = self._topics.get(topic)
            if subscribers is not None:
                subscribers.discard(queue)
                if not subscribers:
                    self._topics.pop(topic, None)

    def subscriber_count(self, topic: str) -> int:
        """Return the number of active subscribers for a topic (for tests)."""
        return len(self._topics.get(topic, set()))


# Process-wide singleton. Single-node Hub only.
execution_broker = ExecutionBroker()
