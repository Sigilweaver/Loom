"""Tests for execution timeout enforcement."""

import asyncio

import pytest

from app.api.models.workflow import Socket, Tool, Workflow, WorkflowMeta
from app.domain.execution.executor import WorkflowExecutor
from app.utils.errors import ExecutionTimeoutError


def _trivial_workflow() -> Workflow:
    return Workflow(
        meta=WorkflowMeta(
            name="timeout test",
            description="",
            author="t",
            workflowId="wp09-timeout",
            created="2025-01-01",
        ),
        tools=[
            Tool(
                id="input1",
                type="Input",
                x=0,
                y=0,
                config={"category": "file", "type": "csv", "source": "/nonexistent.csv"},
                sockets=[Socket(id="output", direction="output")],
            )
        ],
        wires=[],
    )


@pytest.mark.asyncio
async def test_execute_workflow_raises_on_timeout(monkeypatch):
    """A workflow whose execution exceeds max_execution_time_seconds raises 504-mapped error."""
    from app.domain.execution import executor as executor_mod

    monkeypatch.setattr(executor_mod.settings, "max_execution_time_seconds", 1)

    async def _slow_plan(self, plan, cache_mgr):
        await asyncio.sleep(5)
        return [], 0

    monkeypatch.setattr(WorkflowExecutor, "_execute_plan", _slow_plan)

    exe = WorkflowExecutor()
    with pytest.raises(ExecutionTimeoutError) as excinfo:
        await exe.execute_workflow(_trivial_workflow())
    assert "1s budget" in str(excinfo.value) or "exceeded" in str(excinfo.value)
    # error_id correlation is preserved
    assert excinfo.value.error_id


@pytest.mark.asyncio
async def test_timeout_completes_within_slack(monkeypatch):
    """The timeout should fire close to the configured budget, not the full sleep."""
    import time

    from app.domain.execution import executor as executor_mod

    monkeypatch.setattr(executor_mod.settings, "max_execution_time_seconds", 1)

    async def _slow_plan(self, plan, cache_mgr):
        await asyncio.sleep(10)
        return [], 0

    monkeypatch.setattr(WorkflowExecutor, "_execute_plan", _slow_plan)

    exe = WorkflowExecutor()
    t0 = time.monotonic()
    with pytest.raises(ExecutionTimeoutError):
        await exe.execute_workflow(_trivial_workflow())
    elapsed = time.monotonic() - t0
    # Honored within ~2s of the 1s budget on a loaded CI runner.
    assert elapsed < 3.0, f"timeout took {elapsed:.2f}s, expected < 3s"
