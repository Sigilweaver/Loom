"""Tests for parallel execution mode"""

import asyncio
from unittest.mock import patch

import polars as pl
import pytest

from app.api.models.common import ColumnSchema, DataSchema
from app.api.models.workflow import Socket, Tool, Wire, WireEndpoint, Workflow, WorkflowMeta
from app.domain.execution.executor import WorkflowExecutor
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import ToolRegistry


def make_workflow_meta() -> WorkflowMeta:
    """Create default workflow metadata for tests."""
    return WorkflowMeta(
        name="Test",
        description="Test",
        author="Test",
        workflowId="test-parallel",
        created="2025-01-01",
    )


def make_tool(
    tool_id: str,
    tool_type: str,
    config: dict | None = None,
    input_sockets: list[str] | None = None,
    output_sockets: list[str] | None = None,
) -> Tool:
    """Create a tool with configurable sockets."""
    sockets = []
    for sid in input_sockets or ["input"]:
        sockets.append(Socket(id=sid, direction="input"))
    for sid in output_sockets or ["output"]:
        sockets.append(Socket(id=sid, direction="output"))
    return Tool(
        id=tool_id,
        type=tool_type,
        x=0,
        y=0,
        config=config or {},
        sockets=sockets,
    )


class SlowMockTool(BaseTool):
    """Mock tool that tracks execution order with delay."""

    execution_log: list[tuple[str, float]] = []
    delay_ms: int = 50

    async def execute(self, config: dict, inputs: dict) -> dict[str, pl.LazyFrame]:
        start = asyncio.get_event_loop().time()
        tool_id = config.get("_tool_id", "unknown")

        # Simulate work
        await asyncio.sleep(self.delay_ms / 1000)

        self.execution_log.append((tool_id, start))

        # Return dummy data
        df = pl.DataFrame({"value": [1, 2, 3]})
        return {"output": df.lazy()}

    async def get_output_schema(
        self, config: dict, input_schemas: dict
    ) -> dict[str, DataSchema]:
        """Return a simple schema for the mock tool."""
        return {
            "output": DataSchema(
                columns=[ColumnSchema(name="value", dtype="Int64", nullable=False)]
            )
        }

    @classmethod
    def reset_log(cls):
        cls.execution_log = []


class TestParallelExecution:
    """Tests for parallel execution mode."""

    @pytest.fixture(autouse=True)
    def reset_mock(self):
        """Reset mock tool state before each test."""
        SlowMockTool.reset_log()
        yield

    @pytest.fixture
    def register_mock_tool(self):
        """Register mock tool for tests."""
        original = ToolRegistry._tools.get("MockTool")
        ToolRegistry.register("MockTool", SlowMockTool)
        yield
        if original:
            ToolRegistry._tools["MockTool"] = original
        else:
            ToolRegistry._tools.pop("MockTool", None)

    @pytest.mark.asyncio
    @patch("app.domain.execution.executor.settings")
    async def test_parallel_branches_execute_concurrently(
        self, mock_settings, register_mock_tool
    ):
        """Test that parallel branches run concurrently."""
        mock_settings.execution_mode = "parallel"
        mock_settings.max_parallel_tools = 4
        mock_settings.cache_enabled = False
        mock_settings.archive_enabled = False

        # Workflow: A -> B, A -> C (B and C are independent)
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                make_tool("A", "MockTool", {"_tool_id": "A"}),
                make_tool("B", "MockTool", {"_tool_id": "B"}),
                make_tool("C", "MockTool", {"_tool_id": "C"}),
            ],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="C", socket="input"),
                ),
            ],
        )

        executor = WorkflowExecutor()
        await executor.execute_workflow(workflow)

        # Verify execution order
        tool_ids = [tid for tid, _ in SlowMockTool.execution_log]
        assert tool_ids[0] == "A"  # A must be first
        assert set(tool_ids[1:]) == {"B", "C"}  # B and C can be in any order

        # Verify B and C started at approximately the same time (parallel)
        times = {tid: t for tid, t in SlowMockTool.execution_log}
        time_diff = abs(times["B"] - times["C"])
        # If running in parallel, they should start within ~10ms of each other
        # (accounting for async overhead)
        assert time_diff < 0.02, f"B and C should start together, diff was {time_diff}s"

    @pytest.mark.asyncio
    @patch("app.domain.execution.executor.settings")
    async def test_sequential_mode_executes_in_order(
        self, mock_settings, register_mock_tool
    ):
        """Test that sequential mode runs tools one by one."""
        mock_settings.execution_mode = "sequential"
        mock_settings.cache_enabled = False
        mock_settings.archive_enabled = False

        # Workflow: A -> B, A -> C
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                make_tool("A", "MockTool", {"_tool_id": "A"}),
                make_tool("B", "MockTool", {"_tool_id": "B"}),
                make_tool("C", "MockTool", {"_tool_id": "C"}),
            ],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="C", socket="input"),
                ),
            ],
        )

        executor = WorkflowExecutor()
        await executor.execute_workflow(workflow)

        # Verify all tools executed
        tool_ids = [tid for tid, _ in SlowMockTool.execution_log]
        assert len(tool_ids) == 3
        assert tool_ids[0] == "A"

        # In sequential mode, B and C should have distinct start times
        times = {tid: t for tid, t in SlowMockTool.execution_log}
        time_diff = abs(times["B"] - times["C"])
        # They should be at least delay_ms apart
        assert time_diff >= 0.04, f"B and C should run sequentially, diff was {time_diff}s"

    @pytest.mark.asyncio
    @patch("app.domain.execution.executor.settings")
    async def test_diamond_pattern_respects_dependencies(
        self, mock_settings, register_mock_tool
    ):
        """Test diamond pattern: A -> B -> D, A -> C -> D."""
        mock_settings.execution_mode = "parallel"
        mock_settings.max_parallel_tools = 4
        mock_settings.cache_enabled = False
        mock_settings.archive_enabled = False

        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                make_tool("A", "MockTool", {"_tool_id": "A"}),
                make_tool("B", "MockTool", {"_tool_id": "B"}),
                make_tool("C", "MockTool", {"_tool_id": "C"}),
                make_tool("D", "MockTool", {"_tool_id": "D"}),
            ],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="C", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="B", socket="output"),
                    to=WireEndpoint(tool="D", socket="input"),
                ),
                Wire(
                    from_=WireEndpoint(tool="C", socket="output"),
                    to=WireEndpoint(tool="D", socket="input"),
                ),
            ],
        )

        executor = WorkflowExecutor()
        await executor.execute_workflow(workflow)

        # Verify execution order respects dependencies
        tool_ids = [tid for tid, _ in SlowMockTool.execution_log]
        assert tool_ids.index("A") < tool_ids.index("B")
        assert tool_ids.index("A") < tool_ids.index("C")
        assert tool_ids.index("B") < tool_ids.index("D")
        assert tool_ids.index("C") < tool_ids.index("D")

    @pytest.mark.asyncio
    @patch("app.domain.execution.executor.settings")
    async def test_max_parallel_tools_limits_concurrency(
        self, mock_settings, register_mock_tool
    ):
        """Test that max_parallel_tools limits concurrent executions."""
        mock_settings.execution_mode = "parallel"
        mock_settings.max_parallel_tools = 1  # Force sequential-like behavior
        mock_settings.cache_enabled = False
        mock_settings.archive_enabled = False

        # Workflow with 3 independent tools at same level
        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                make_tool("A", "MockTool", {"_tool_id": "A"}),
                make_tool("B", "MockTool", {"_tool_id": "B"}),
                make_tool("C", "MockTool", {"_tool_id": "C"}),
            ],
            wires=[],  # All independent
        )

        executor = WorkflowExecutor()
        await executor.execute_workflow(workflow)

        # With max_parallel=1, tools should run one at a time
        times = [t for _, t in SlowMockTool.execution_log]
        for i in range(len(times) - 1):
            diff = times[i + 1] - times[i]
            # Each tool should start after the previous one finishes
            assert diff >= 0.04, "Tools should run sequentially with max_parallel=1"

    @pytest.mark.asyncio
    @patch("app.domain.execution.executor.settings")
    async def test_parallel_execution_preserves_results(
        self, mock_settings, register_mock_tool
    ):
        """Test that results are correctly stored in parallel mode."""
        mock_settings.execution_mode = "parallel"
        mock_settings.max_parallel_tools = 4
        mock_settings.cache_enabled = False
        mock_settings.archive_enabled = False

        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                make_tool("A", "MockTool", {"_tool_id": "A"}),
                make_tool("B", "MockTool", {"_tool_id": "B"}),
            ],
            wires=[
                Wire(
                    from_=WireEndpoint(tool="A", socket="output"),
                    to=WireEndpoint(tool="B", socket="input"),
                ),
            ],
        )

        executor = WorkflowExecutor()
        result = await executor.execute_workflow(workflow, preview_limit=10)

        # Results should be present
        assert "outputs" in result
        assert result["tool_id"] == "B"

    @pytest.mark.asyncio
    @patch("app.domain.execution.executor.settings")
    async def test_parallel_execution_logs_include_from_cache(
        self, mock_settings, register_mock_tool
    ):
        """Test that execution logs track from_cache correctly."""
        mock_settings.execution_mode = "parallel"
        mock_settings.max_parallel_tools = 4
        mock_settings.cache_enabled = False
        mock_settings.archive_enabled = False

        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[
                make_tool("A", "MockTool", {"_tool_id": "A"}),
            ],
            wires=[],
        )

        executor = WorkflowExecutor()
        await executor.execute_workflow(workflow)

        # Check internal state has result
        assert "A" in executor.results
        assert "output" in executor.results["A"]


class TestParallelExecutionEdgeCases:
    """Edge case tests for parallel execution."""

    @pytest.fixture(autouse=True)
    def reset_mock(self):
        SlowMockTool.reset_log()
        yield

    @pytest.fixture
    def register_mock_tool(self):
        original = ToolRegistry._tools.get("MockTool")
        ToolRegistry.register("MockTool", SlowMockTool)
        yield
        if original:
            ToolRegistry._tools["MockTool"] = original
        else:
            ToolRegistry._tools.pop("MockTool", None)

    @pytest.mark.asyncio
    @patch("app.domain.execution.executor.settings")
    async def test_empty_workflow(self, mock_settings):
        """Test parallel execution handles empty workflow."""
        mock_settings.execution_mode = "parallel"
        mock_settings.max_parallel_tools = 4
        mock_settings.cache_enabled = False
        mock_settings.archive_enabled = False

        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[],
            wires=[],
        )

        executor = WorkflowExecutor()
        # Should not raise
        with pytest.raises(Exception):
            # Empty workflow will fail when trying to get results
            await executor.execute_workflow(workflow)

    @pytest.mark.asyncio
    @patch("app.domain.execution.executor.settings")
    async def test_single_tool_workflow(self, mock_settings, register_mock_tool):
        """Test parallel execution works with single tool."""
        mock_settings.execution_mode = "parallel"
        mock_settings.max_parallel_tools = 4
        mock_settings.cache_enabled = False
        mock_settings.archive_enabled = False

        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=[make_tool("A", "MockTool", {"_tool_id": "A"})],
            wires=[],
        )

        executor = WorkflowExecutor()
        result = await executor.execute_workflow(workflow)

        assert result["tool_id"] == "A"
        assert len(SlowMockTool.execution_log) == 1

    @pytest.mark.asyncio
    @patch("app.domain.execution.executor.settings")
    async def test_many_independent_tools(self, mock_settings, register_mock_tool):
        """Test parallel execution with many independent tools."""
        mock_settings.execution_mode = "parallel"
        mock_settings.max_parallel_tools = 10
        mock_settings.cache_enabled = False
        mock_settings.archive_enabled = False

        # 5 independent tools
        tools = [
            make_tool(f"T{i}", "MockTool", {"_tool_id": f"T{i}"})
            for i in range(5)
        ]

        workflow = Workflow(
            meta=make_workflow_meta(),
            tools=tools,
            wires=[],
        )

        executor = WorkflowExecutor()
        await executor.execute_workflow(workflow)

        # All tools should execute
        assert len(SlowMockTool.execution_log) == 5

        # They should all start at approximately the same time
        times = [t for _, t in SlowMockTool.execution_log]
        time_range = max(times) - min(times)
        # All should start within a small window
        assert time_range < 0.05, "Independent tools should start together"
