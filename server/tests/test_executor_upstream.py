"""Tests for how the executor runs upstream tools (#83, #84).

Covers two guarantees:
- Partial executions (target tool, schema, metadata, profile) run only the target
  and its ancestors, never unrelated branches.
- Every path that runs tools goes through the one budgeted runner, so the wall-clock
  timeout, the configured execution mode and result locking apply everywhere.
"""

import asyncio
from pathlib import Path
from typing import Any

import polars as pl
import pytest

from app.domain.execution import executor as executor_mod
from app.domain.execution.executor import WorkflowExecutor
from app.domain.models.workflow import Socket, Tool, Wire, WireEndpoint, Workflow, WorkflowMeta
from app.utils.errors import ExecutionError, ExecutionTimeoutError, ValidationError


def _csv(tmp_path: Path, name: str) -> str:
    path = tmp_path / f"{name}.csv"
    pl.DataFrame({"a": [1, 2, 3], "b": ["x", "y", "z"]}).write_csv(path)
    return str(path)


def _input(tool_id: str, source: str) -> Tool:
    return Tool(
        id=tool_id,
        type="Input",
        x=0,
        y=0,
        config={"category": "file", "type": "csv", "source": source, "csvMode": "scan"},
        sockets=[Socket(id="output", direction="output")],
    )


def _filter(tool_id: str, expression: str = "pl.col('a') > 1") -> Tool:
    return Tool(
        id=tool_id,
        type="Filter",
        x=0,
        y=0,
        config={"expression": expression},
        sockets=[
            Socket(id="input", direction="input"),
            Socket(id="output-true", direction="output"),
            Socket(id="output-false", direction="output"),
        ],
    )


def _wire(src: str, dst: str, src_socket: str = "output") -> Wire:
    return Wire(
        from_=WireEndpoint(tool=src, socket=src_socket),
        to=WireEndpoint(tool=dst, socket="input"),
    )


def _two_branch_workflow(tmp_path: Path, unrelated_filter: Tool | None = None) -> Workflow:
    """input1 -> filter1, plus an unrelated input2 -> filter2."""
    return Workflow(
        meta=WorkflowMeta(
            name="branches",
            description="",
            author="t",
            workflowId="test-executor-upstream",
            created="2025-01-01",
        ),
        tools=[
            _input("input1", _csv(tmp_path, "one")),
            _filter("filter1"),
            _input("input2", _csv(tmp_path, "two")),
            unrelated_filter or _filter("filter2"),
        ],
        wires=[_wire("input1", "filter1"), _wire("input2", "filter2")],
    )


class _RecordingExecutor(WorkflowExecutor):
    """Executor that records which tools it actually ran."""

    def __init__(self) -> None:
        super().__init__()
        self.ran: list[str] = []

    async def _execute_tool_with_cache(
        self, tool: Tool, inputs: Any, plan: Any, cache_mgr: Any
    ) -> Any:
        self.ran.append(tool.id)
        return await super()._execute_tool_with_cache(tool, inputs, plan, cache_mgr)


@pytest.fixture(autouse=True)
def _no_cache(monkeypatch):
    monkeypatch.setattr(executor_mod.settings, "cache_enabled", False, raising=False)


class TestPartialExecutionSkipsUnrelatedBranches:
    async def test_execute_workflow_with_target(self, tmp_path):
        exe = _RecordingExecutor()
        await exe.execute_workflow(_two_branch_workflow(tmp_path), target_tool_id="filter1")
        assert sorted(exe.ran) == ["filter1", "input1"]
        assert set(exe.results) == {"filter1", "input1"}

    async def test_execute_single_tool(self, tmp_path):
        exe = _RecordingExecutor()
        await exe.execute_single_tool(
            _two_branch_workflow(tmp_path), "filter1", socket_id="output-true"
        )
        assert sorted(exe.ran) == ["filter1", "input1"]

    async def test_schema_path_runs_only_ancestors_of_target(self, tmp_path):
        exe = _RecordingExecutor()
        result = await exe.get_tool_schema(
            _two_branch_workflow(tmp_path), "filter1", socket_id="output-true"
        )
        assert exe.ran == ["input1"]  # not filter1 itself, not the other branch
        assert {c.name for c in result["data_schema"].columns} == {"a", "b"}

    async def test_metadata_path_runs_only_ancestors_of_target(self, tmp_path):
        exe = _RecordingExecutor()
        result = await exe.get_tool_metadata(_two_branch_workflow(tmp_path), "filter1", "input")
        assert exe.ran == ["input1"]
        assert {c["name"] for c in result["columns"]} == {"a", "b"}

    async def test_profile_path_runs_target_and_ancestors_only(self, tmp_path):
        exe = _RecordingExecutor()
        result = await exe.profile_columns(
            _two_branch_workflow(tmp_path), "filter1", socket_id="output-true"
        )
        assert sorted(exe.ran) == ["filter1", "input1"]
        assert result["row_count"] == 2

    async def test_unrelated_invalid_config_does_not_block_partial_run(self, tmp_path):
        broken = Tool(
            id="filter2",
            type="Sort",
            x=0,
            y=0,
            config={"sortColumns": [{"column": "a", "order": "descending"}]},  # bad key
            sockets=[Socket(id="input", direction="input")],
        )
        workflow = _two_branch_workflow(tmp_path, unrelated_filter=broken)

        exe = _RecordingExecutor()
        await exe.execute_workflow(workflow, target_tool_id="filter1")
        assert sorted(exe.ran) == ["filter1", "input1"]

        # The same config still fails when its branch is part of the run.
        with pytest.raises(ExecutionError, match="validation failed"):
            await WorkflowExecutor().execute_workflow(workflow)

    async def test_unknown_target_is_a_validation_error(self, tmp_path):
        workflow = _two_branch_workflow(tmp_path)
        for call in (
            WorkflowExecutor().execute_workflow(workflow, target_tool_id="nope"),
            WorkflowExecutor().get_tool_schema(workflow, "nope", "output"),
            WorkflowExecutor().get_tool_metadata(workflow, "nope"),
            WorkflowExecutor().profile_columns(workflow, "nope", "output"),
        ):
            with pytest.raises(ValidationError, match="nope"):
                await call


class TestSingleBudgetedRunner:
    @pytest.fixture
    def slow_plan(self, monkeypatch):
        monkeypatch.setattr(executor_mod.settings, "max_execution_time_seconds", 1)

        async def _slow(self, plan, cache_mgr):
            await asyncio.sleep(5)
            return [], 0

        monkeypatch.setattr(WorkflowExecutor, "_execute_plan", _slow)

    async def test_schema_path_honors_timeout(self, tmp_path, slow_plan):
        with pytest.raises(ExecutionTimeoutError):
            await WorkflowExecutor().get_tool_schema(
                _two_branch_workflow(tmp_path), "filter1", "output-true"
            )

    async def test_metadata_path_honors_timeout(self, tmp_path, slow_plan):
        with pytest.raises(ExecutionTimeoutError):
            await WorkflowExecutor().get_tool_metadata(_two_branch_workflow(tmp_path), "filter1")

    async def test_profile_path_honors_timeout(self, tmp_path, slow_plan):
        with pytest.raises(ExecutionTimeoutError):
            await WorkflowExecutor().profile_columns(
                _two_branch_workflow(tmp_path), "filter1", "output-true"
            )

    @pytest.mark.parametrize("mode", ["parallel", "sequential"])
    async def test_every_path_follows_execution_mode(self, tmp_path, monkeypatch, mode):
        """Schema/metadata/profile use the same mode as a full execution."""
        monkeypatch.setattr(executor_mod.settings, "execution_mode", mode)
        used: list[str] = []
        real_parallel = WorkflowExecutor._execute_plan_parallel
        real_sequential = WorkflowExecutor._execute_plan_sequential

        async def _parallel(self, plan, cache_mgr):
            used.append("parallel")
            return await real_parallel(self, plan, cache_mgr)

        async def _sequential(self, plan, cache_mgr):
            used.append("sequential")
            return await real_sequential(self, plan, cache_mgr)

        monkeypatch.setattr(WorkflowExecutor, "_execute_plan_parallel", _parallel)
        monkeypatch.setattr(WorkflowExecutor, "_execute_plan_sequential", _sequential)

        workflow = _two_branch_workflow(tmp_path)
        await WorkflowExecutor().execute_workflow(workflow)
        await WorkflowExecutor().get_tool_schema(workflow, "filter1", "output-true")
        await WorkflowExecutor().get_tool_metadata(workflow, "filter1")
        await WorkflowExecutor().profile_columns(workflow, "filter1", "output-true")
        assert used == [mode] * 4

    @pytest.mark.parametrize("mode", ["parallel", "sequential"])
    async def test_result_writes_hold_the_lock(self, tmp_path, monkeypatch, mode):
        monkeypatch.setattr(executor_mod.settings, "execution_mode", mode)

        class _SpyLock:
            def __init__(self) -> None:
                self.acquired = 0
                self.held = False

            async def __aenter__(self) -> None:
                self.acquired += 1
                self.held = True

            async def __aexit__(self, *exc: Any) -> None:
                self.held = False

        class _CheckedResults(dict[str, dict[str, pl.LazyFrame]]):
            def __init__(self, lock: _SpyLock) -> None:
                super().__init__()
                self._lock = lock

            def __setitem__(self, key: str, value: dict[str, pl.LazyFrame]) -> None:
                assert self._lock.held, f"results[{key!r}] written without the lock"
                super().__setitem__(key, value)

        workflow = _two_branch_workflow(tmp_path)
        for run in (
            lambda e: e.execute_workflow(workflow),
            lambda e: e.get_tool_schema(workflow, "filter1", "output-true"),
            lambda e: e.get_tool_metadata(workflow, "filter1"),
            lambda e: e.profile_columns(workflow, "filter1", "output-true"),
        ):
            exe = WorkflowExecutor()
            lock = _SpyLock()
            monkeypatch.setattr(exe, "_results_lock", lock)
            exe.results = _CheckedResults(lock)
            await run(exe)
            assert lock.acquired >= 1
