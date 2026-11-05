"""Tests that tool config validation actually runs on the execution path.

Regression coverage for the class of bug where a malformed or drifted tool
config (e.g. the Sort `order` vs `direction` drift) executed with silently
wrong results because `BaseTool.validate_config` was never called.
"""

import pytest

from app.domain.execution.executor import WorkflowExecutor
from app.domain.models.workflow import Tool, Workflow, WorkflowMeta
from app.domain.tools.implementations.sort import SortTool
from app.utils.errors import ValidationError


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
        with pytest.raises(ValidationError) as exc:
            await WorkflowExecutor().execute_workflow(wf)
        assert "validation failed" in str(exc.value).lower()


class TestUnknownConfigKeys:
    """Unknown keys on open config models are reported, never silently dropped."""

    def test_unknown_key_on_open_model_is_reported(self):
        from app.domain.tools.implementations.unique import UniqueTool

        assert UniqueTool().unknown_config_keys({"columns": ["a"], "colums": ["b"]}) == [
            "colums"
        ]

    def test_editor_state_and_underscore_keys_are_not_reported(self):
        from app.domain.tools.implementations.filter import FilterTool
        from app.domain.tools.implementations.summarize import SummarizeTool

        filter_config = {
            "expression": "[a] > 1",
            "mode": "Basic",
            "conditions": [],
            "combinator": "and",
            "conditionGroup": {},
            "_emit": {"expression": True},
        }
        assert FilterTool().unknown_config_keys(filter_config) == []
        assert SummarizeTool().unknown_config_keys({"actions": [], "groupByColumns": []}) == []

    def test_reader_writer_options_are_forwarded_not_reported(self):
        from app.domain.tools.implementations.input import InputTool
        from app.domain.tools.implementations.output import OutputTool

        assert InputTool().unknown_config_keys({"type": "csv", "separator": ";"}) == []
        assert OutputTool().unknown_config_keys({"type": "csv", "include_header": True}) == []

    def test_forbid_model_reports_errors_not_warnings(self):
        # Sort rejects unknown keys in validate_config, so they are not
        # double-reported as warnings.
        assert SortTool().unknown_config_keys({"sortColumns": [], "bogus": 1}) == []

    @pytest.mark.parametrize(
        ("tool_type", "config"),
        [
            # Studio's defaultConfig for each tool (studio/src/data/tools.ts).
            ("Input", {"placeholder": "Configuration coming soon..."}),
            ("Output", {"placeholder": "Configuration coming soon..."}),
            ("Filter", {"expression": "", "mode": "Basic", "conditions": [], "combinator": "and"}),
            ("Select", {"columnConfigs": []}),
            ("Sort", {"sortColumns": []}),
            ("Formula", {"operations": [], "expression": "", "column_name": ""}),
            ("Sample", {"mode": "FirstN", "n": 100, "percent": 10.0, "offset": 0, "seed": None}),
            ("Unique", {"columns": [], "mode": "First"}),
            ("Union", {"mode": "ByName"}),
            ("Join", {"joinType": "inner", "leftKeys": [], "rightKeys": []}),
            (
                "Summarize",
                {
                    "groupByColumns": [],
                    "aggregations": [{"column": "", "operation": "Sum", "outputName": ""}],
                    "includeNulls": False,
                },
            ),
            ("Pivot", {"on": "", "index": [], "values": "", "aggregateFunction": "first"}),
            (
                "Unpivot",
                {"on": [], "index": [], "variableName": "variable", "valueName": "value"},
            ),
        ],
    )
    def test_studio_default_configs_report_nothing(self, tool_type, config):
        from app.domain.tools.registry import ToolRegistry

        assert ToolRegistry.get(tool_type).unknown_config_keys(config) == []

    async def test_execute_workflow_reports_unknown_key(self, tmp_path, monkeypatch):
        import polars as pl

        from app.config import settings
        from app.domain.models.workflow import Socket, Wire, WireEndpoint

        monkeypatch.setattr(settings, "archive_enabled", False)
        src = tmp_path / "in.csv"
        pl.DataFrame({"a": [1, 1, 2]}).write_csv(src)
        tools = [
            Tool(id="I1", type="Input", x=0, y=0,
                 config={"type": "csv", "source": str(src)},
                 sockets=[Socket(id="output", direction="output")]),
            Tool(id="U1", type="Unique", x=0, y=0,
                 config={"columns": ["a"], "colums": ["a"]},
                 sockets=[Socket(id="input", direction="input"),
                          Socket(id="output-unique", direction="output"),
                          Socket(id="output-duplicate", direction="output")]),
        ]
        wires = [Wire(from_=WireEndpoint(tool="I1", socket="output"),
                      to=WireEndpoint(tool="U1", socket="input"))]
        wf = Workflow(meta=_meta(), tools=tools, wires=wires)
        result = await WorkflowExecutor().execute_workflow(wf, target_tool_id="U1")
        assert result["config_warnings"] == ["U1 (Unique): unknown config key 'colums' is ignored"]
        assert result["outputs"]["output-unique"]["row_count"] == 2
