"""Tests that tool config validation actually runs on the execution path.

Regression coverage for the class of bug where a malformed or drifted tool
config (e.g. the Sort `order` vs `direction` drift) executed with silently
wrong results because `BaseTool.validate_config` was never called.
"""

import pytest

from app.domain.execution.executor import WorkflowExecutor
from app.domain.models.workflow import Tool, Workflow, WorkflowMeta
from app.domain.tools.implementations.sort import SortTool
from app.utils.errors import ExecutionError


def _meta() -> WorkflowMeta:
    return WorkflowMeta(
        name="Test",
        description="Test",
        author="Test",
        workflowId="test",
        created="2025-08-01",
    )


def _workflow(tools: list[Tool]) -> Workflow:
    return Workflow(meta=_meta(), tools=tools, wires=[])


class TestSortConfigContract:
    """The Sort config model must reject drifted keys instead of dropping them."""

    async def test_order_instead_of_direction_is_rejected(self):
        # `order: "descending"` is the drift the AI layer used to emit; it must
        # NOT be silently ignored (which produced an ascending sort).
        errors = await SortTool().validate_config(
            {"sortColumns": [{"column": "amount", "order": "descending"}]}
        )
        assert errors, "drifted `order` key should produce a validation error"

    async def test_valid_direction_passes(self):
        errors = await SortTool().validate_config(
            {"sortColumns": [{"column": "amount", "direction": "desc"}]}
        )
        assert errors == []

    async def test_unknown_top_level_key_is_rejected(self):
        errors = await SortTool().validate_config(
            {"sortColumns": [], "bogus": 1}
        )
        assert errors


class TestExecutorEnforcesConfig:
    """WorkflowExecutor must reject invalid tool configs before executing."""

    async def test_validate_tool_configs_flags_bad_config(self):
        wf = _workflow(
            [Tool(id="S1", type="Sort", x=0, y=0,
                  config={"sortColumns": [{"column": "amount", "order": "descending"}]},
                  sockets=[])]
        )
        errors = await WorkflowExecutor()._validate_tool_configs(wf)
        assert any("S1" in e and "Sort" in e for e in errors)

    async def test_validate_tool_configs_passes_valid(self):
        wf = _workflow(
            [Tool(id="S1", type="Sort", x=0, y=0,
                  config={"sortColumns": [{"column": "amount", "direction": "desc"}]},
                  sockets=[])]
        )
        assert await WorkflowExecutor()._validate_tool_configs(wf) == []

    async def test_unknown_tool_type_is_reported(self):
        wf = _workflow([Tool(id="X1", type="NotARealTool", x=0, y=0, config={}, sockets=[])])
        errors = await WorkflowExecutor()._validate_tool_configs(wf)
        assert any("X1" in e for e in errors)

    async def test_execute_workflow_fails_validation_for_bad_config(self):
        wf = _workflow(
            [Tool(id="S1", type="Sort", x=0, y=0,
                  config={"sortColumns": [{"column": "amount", "order": "descending"}]},
                  sockets=[])]
        )
        with pytest.raises(ExecutionError) as exc:
            await WorkflowExecutor().execute_workflow(wf)
        assert "validation failed" in str(exc.value).lower()
