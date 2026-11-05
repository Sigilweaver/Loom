"""Exported Python must produce the same data as the engine.

Builds a workflow, runs it through the executor, runs the generated script,
and compares the written files. Guards the "code as truth" promise for the
tools that share operation builders between execute() and to_python_code().
"""

import subprocess
import sys
from pathlib import Path
from typing import Any

import polars as pl
import pytest

from app.domain.execution.executor import WorkflowExecutor
from app.domain.models.workflow import Socket, Tool, Wire, WireEndpoint, Workflow, WorkflowMeta
from app.domain.workflow.code_generator import PythonCodeGenerator

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _no_archive(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "archive_enabled", False)


_SOCKETS: dict[str, tuple[list[str], list[str]]] = {
    "Input": ([], ["output"]),
    "Output": (["input"], []),
    "Filter": (["input"], ["output-true", "output-false"]),
    "Sort": (["input"], ["output"]),
    "Sample": (["input"], ["output"]),
    "Summarize": (["input"], ["output"]),
    "Union": (["input"], ["output"]),
    "Unique": (["input"], ["output-unique", "output-duplicate"]),
}


def _tool(tool_id: str, tool_type: str, config: dict[str, Any]) -> Tool:
    ins, outs = _SOCKETS[tool_type]
    sockets = [Socket(id=i, direction="input") for i in ins]
    sockets += [Socket(id=o, direction="output") for o in outs]
    return Tool(id=tool_id, type=tool_type, x=0, y=0, config=config, sockets=sockets)


def _wire(src: str, src_socket: str, dst: str, dst_socket: str = "input") -> Wire:
    return Wire(
        from_=WireEndpoint(tool=src, socket=src_socket),
        to=WireEndpoint(tool=dst, socket=dst_socket),
    )


def _workflow(tools: list[Tool], wires: list[Wire]) -> Workflow:
    return Workflow(
        meta=WorkflowMeta(
            name="Parity",
            description="",
            author="test",
            workflowId="wf-parity",
            created="2026-01-01T00:00:00Z",
        ),
        tools=tools,
        wires=wires,
    )


def _csv_input(tool_id: str) -> Tool:
    return _tool(
        tool_id,
        "Input",
        {
            "category": "file",
            "type": "csv",
            "source": str(FIXTURES / "titanic.csv"),
            "csvMode": "scan",
        },
    )


def _csv_output(tool_id: str, path: Path) -> Tool:
    return _tool(tool_id, "Output", {"type": "csv", "destination": str(path), "csvMode": "sink"})


async def _run_both(workflow: Workflow, tmp_path: Path, out_names: list[str]) -> None:
    """Run engine and exported script into separate dirs, compare each output file."""
    engine_dir = tmp_path / "engine"
    script_dir = tmp_path / "script"
    engine_dir.mkdir()
    script_dir.mkdir()

    def retarget(directory: Path) -> Workflow:
        copy = workflow.model_copy(deep=True)
        for tool in copy.tools:
            if tool.type == "Output":
                tool.config["destination"] = str(directory / Path(tool.config["destination"]).name)
        return copy

    await WorkflowExecutor().execute_workflow(retarget(engine_dir))

    code = PythonCodeGenerator(retarget(script_dir)).generate()
    assert "# ERROR" not in code
    assert "# TODO" not in code
    script = tmp_path / "exported.py"
    script.write_text(code)
    proc = subprocess.run(
        [sys.executable, str(script)], capture_output=True, text=True, timeout=120, check=False
    )
    assert proc.returncode == 0, proc.stderr

    for name in out_names:
        engine = pl.read_csv(engine_dir / name)
        exported = pl.read_csv(script_dir / name)
        assert engine.height > 0, name
        assert engine.equals(exported), name


@pytest.mark.asyncio
async def test_filter_sort_summarize_export_matches_engine(tmp_path: Path):
    tools = [
        _csv_input("in1"),
        _tool("flt", "Filter", {"expression": "pl.col('Age') > 30"}),
        _tool(
            "srt",
            "Sort",
            {"sortColumns": [{"column": "Fare", "direction": "desc", "nullsFirst": False}]},
        ),
        _tool(
            "sum",
            "Summarize",
            {
                "groupByColumns": ["Pclass", "Sex"],
                "aggregations": [
                    {"column": "Fare", "operation": "Mean", "outputName": "avg_fare"},
                    {"column": "PassengerId", "operation": "Count", "outputName": "n"},
                ],
            },
        ),
        _csv_output("out_main", tmp_path / "main.csv"),
    ]
    wires = [
        _wire("in1", "output", "flt"),
        _wire("flt", "output-true", "srt"),
        _wire("srt", "output", "sum"),
        _wire("sum", "output", "out_main"),
    ]
    await _run_both(_workflow(tools, wires), tmp_path, ["main.csv"])


@pytest.mark.asyncio
async def test_filter_false_branch_keeps_null_rows_in_export(tmp_path: Path):
    """Age is null for some Titanic rows; both paths must route them to False."""
    tools = [
        _csv_input("in1"),
        _tool("flt", "Filter", {"expression": "pl.col('Age') > 30"}),
        _csv_output("out_f", tmp_path / "false.csv"),
    ]
    wires = [_wire("in1", "output", "flt"), _wire("flt", "output-false", "out_f")]
    await _run_both(_workflow(tools, wires), tmp_path, ["false.csv"])
    total = pl.read_csv(FIXTURES / "titanic.csv").height
    engine_false = pl.read_csv(tmp_path / "engine" / "false.csv")
    older = pl.read_csv(FIXTURES / "titanic.csv").filter(pl.col("Age") > 30).height
    assert engine_false.height == total - older


@pytest.mark.asyncio
async def test_unique_union_join_export_matches_engine(tmp_path: Path):
    tools = [
        _csv_input("in1"),
        _tool("uni", "Unique", {"columns": ["Pclass", "Sex"], "mode": "First"}),
        _tool("un", "Union", {"mode": "ByName"}),
        _csv_output("out_u", tmp_path / "union.csv"),
    ]
    wires = [
        _wire("in1", "output", "uni"),
        _wire("uni", "output-unique", "un"),
        _wire("uni", "output-duplicate", "un"),
        _wire("un", "output", "out_u"),
    ]
    await _run_both(_workflow(tools, wires), tmp_path, ["union.csv"])


@pytest.mark.asyncio
async def test_every_aggregation_export_matches_engine(tmp_path: Path):
    """Cabin and Age contain nulls, so null handling is compared too."""
    ops = [
        ("Age", "Sum"), ("Age", "Mean"), ("Age", "Median"), ("Age", "Min"), ("Age", "Max"),
        ("Age", "Std"), ("Age", "Var"), ("Age", "Count"), ("Cabin", "CountDistinct"),
        ("Cabin", "First"), ("Cabin", "Last"), ("Cabin", "Concat"),
    ]
    tools = [
        _csv_input("in1"),
        _tool(
            "sum",
            "Summarize",
            {
                "groupByColumns": ["Pclass"],
                "aggregations": [
                    {"column": col, "operation": op, "outputName": f"{col}_{op}"}
                    for col, op in ops
                ],
            },
        ),
        _csv_output("out_main", tmp_path / "aggs.csv"),
    ]
    wires = [_wire("in1", "output", "sum"), _wire("sum", "output", "out_main")]
    await _run_both(_workflow(tools, wires), tmp_path, ["aggs.csv"])


@pytest.mark.asyncio
async def test_first_percent_export_matches_engine(tmp_path: Path):
    tools = [
        _csv_input("in1"),
        _tool("smp", "Sample", {"mode": "FirstPercent", "percent": 12.5}),
        _csv_output("out_s", tmp_path / "sample.csv"),
    ]
    wires = [_wire("in1", "output", "smp"), _wire("smp", "output", "out_s")]
    await _run_both(_workflow(tools, wires), tmp_path, ["sample.csv"])
