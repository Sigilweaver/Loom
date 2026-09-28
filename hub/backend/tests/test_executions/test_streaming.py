"""Tests for the live execution event broker and SSE streaming endpoints (B6)."""

import asyncio

import pytest

from app.domain.executions.broker import (
    GLOBAL_TOPIC,
    ExecutionBroker,
    execution_broker,
)
from tests.conftest import make_workflow_content, new_client


class TestExecutionBroker:
    """Unit tests for the in-process pub/sub broker."""

    @pytest.mark.asyncio
    async def test_publish_delivers_to_topic_subscriber(self):
        broker = ExecutionBroker()
        with broker.subscribe("exec-1") as queue:
            broker.publish({"id": "exec-1", "status": "running"})
            event = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert event["status"] == "running"

    @pytest.mark.asyncio
    async def test_publish_delivers_to_global_subscriber(self):
        broker = ExecutionBroker()
        with broker.subscribe(GLOBAL_TOPIC) as queue:
            broker.publish({"id": "exec-2", "status": "queued"})
            event = await asyncio.wait_for(queue.get(), timeout=1.0)
        assert event["id"] == "exec-2"

    @pytest.mark.asyncio
    async def test_topic_subscriber_does_not_receive_other_executions(self):
        broker = ExecutionBroker()
        with broker.subscribe("exec-1") as queue:
            broker.publish({"id": "exec-other", "status": "running"})
            with pytest.raises(asyncio.TimeoutError):
                await asyncio.wait_for(queue.get(), timeout=0.1)

    @pytest.mark.asyncio
    async def test_subscribe_cleans_up_on_exit(self):
        broker = ExecutionBroker()
        with broker.subscribe("exec-1"):
            assert broker.subscriber_count("exec-1") == 1
        assert broker.subscriber_count("exec-1") == 0

    @pytest.mark.asyncio
    async def test_publish_with_no_subscribers_is_noop(self):
        broker = ExecutionBroker()
        broker.publish({"id": "nobody", "status": "completed"})
        assert broker.subscriber_count("nobody") == 0

    @pytest.mark.asyncio
    async def test_full_queue_drops_oldest(self):
        broker = ExecutionBroker()
        with broker.subscribe("exec-1") as queue:
            # Fill beyond capacity; oldest events are evicted.
            total = queue.maxsize + 10
            for i in range(total):
                broker.publish({"id": "exec-1", "seq": i})
            assert queue.full()
            first = await asyncio.wait_for(queue.get(), timeout=1.0)
            # The earliest surviving event is not seq 0 (it was dropped).
            assert first["seq"] >= total - queue.maxsize


class TestExecutionStreamEndpoint:
    """Integration tests for the SSE streaming routes."""

    @pytest.mark.asyncio
    async def test_global_stream_requires_auth(self):
        async with new_client() as client:
            response = await client.get("/api/v1/executions/stream")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_trigger_publishes_event_to_broker(self, user_headers, test_server):
        # Subscribe to the shared singleton the API publishes to, then trigger.
        # The queued event is published synchronously during the request, so it
        # is guaranteed to be enqueued by the time the response returns.
        with execution_broker.subscribe(GLOBAL_TOPIC) as queue:
            async with new_client() as client:
                upload = await client.post(
                    "/api/v1/workflows",
                    headers=user_headers,
                    files={
                        "file": (
                            "test.swwf",
                            make_workflow_content(),
                            "application/octet-stream",
                        )
                    },
                    data={"folder_path": "/", "tags": ""},
                )
                workflow_id = upload.json()["id"]

                trigger = await client.post(
                    "/api/v1/executions",
                    headers=user_headers,
                    json={
                        "workflow_id": workflow_id,
                        "server_id": test_server["id"],
                    },
                )
                assert trigger.status_code == 201
                execution_id = trigger.json()["id"]

            events: list[dict] = []
            while not queue.empty():
                events.append(queue.get_nowait())

        assert events, "expected at least one published event"
        matching = [e for e in events if e["id"] == execution_id]
        assert matching
        assert matching[0]["status"] == "queued"
        assert matching[0]["triggered_by"] == "testuser"

    @pytest.mark.asyncio
    async def test_cancel_publishes_event_to_broker(self, user_headers, test_server):
        async with new_client() as client:
            upload = await client.post(
                "/api/v1/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload.json()["id"]

            trigger = await client.post(
                "/api/v1/executions",
                headers=user_headers,
                json={"workflow_id": workflow_id, "server_id": test_server["id"]},
            )
            execution_id = trigger.json()["id"]

            with execution_broker.subscribe(execution_id) as queue:
                cancel = await client.post(
                    f"/api/v1/executions/{execution_id}/cancel",
                    headers=user_headers,
                )
                # Cancellation only succeeds while queued/running; if the
                # background task already finished, there is nothing to assert.
                if cancel.status_code != 200:
                    pytest.skip("execution already terminal before cancel")

                events: list[dict] = []
                while not queue.empty():
                    events.append(queue.get_nowait())

        cancelled = [e for e in events if e["status"] == "cancelled"]
        assert cancelled
        assert cancelled[0]["id"] == execution_id

    @pytest.mark.asyncio
    async def test_execution_stream_forbidden_for_other_user(
        self, user_headers, second_user_headers, test_server
    ):
        async with new_client() as client:
            upload = await client.post(
                "/api/v1/workflows",
                headers=user_headers,
                files={
                    "file": (
                        "test.swwf",
                        make_workflow_content(),
                        "application/octet-stream",
                    )
                },
                data={"folder_path": "/", "tags": ""},
            )
            workflow_id = upload.json()["id"]
            trigger = await client.post(
                "/api/v1/executions",
                headers=user_headers,
                json={"workflow_id": workflow_id, "server_id": test_server["id"]},
            )
            execution_id = trigger.json()["id"]

            response = await client.get(
                f"/api/v1/executions/{execution_id}/stream",
                headers=second_user_headers,
            )
        assert response.status_code == 403
