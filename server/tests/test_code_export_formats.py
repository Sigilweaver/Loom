"""Exported Python must read and write every file format the engine does.

For each format, one workflow writes the Titanic fixture in that format and a
second reads it back to CSV. Both run through the engine and through the
generated script, and the results must be identical. Guards the "code as
truth" promise for Input and Output (#64).
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

FIXTURE = Path(__file__).parent / "fixtures" / "titanic.csv"

# (output config, input config) per format; paths are filled in per run.
FORMATS: dict[str, tuple[dict[str, Any], dict[str, Any]]] = {
    "csv": ({"type": "csv", "csvMode": "sink"}, {"type": "csv", "csvMode": "scan"}),
    "parquet": ({"type": "parquet"}, {"type": "parquet"}),
    "ipc": ({"type": "ipc"}, {"type": "ipc"}),
    # JSON vs NDJSON is chosen by file extension.
    "ndjson": ({"type": "json", "jsonMode": "sink"}, {"type": "json"}),
    "json": ({"type": "json", "jsonMode": "write"}, {"type": "json"}),
    "avro": ({"type": "avro"}, {"type": "avro"}),
    "xlsx": ({"type": "excel"}, {"type": "excel"}),
    "yxdb": ({"type": "yxdb"}, {"type": "yxdb"}),
}


@pytest.fixture(autouse=True)
def _no_archive(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "archive_enabled", False)


def _workflow(source_cfg: dict[str, Any], dest_cfg: dict[str, Any]) -> Workflow:
    tools = [
        Tool(id="src", type="Input", x=0, y=0, config={"category": "file", **source_cfg},
             sockets=[Socket(id="output", direction="output")]),
        Tool(id="dst", type="Output", x=0, y=0, config=dest_cfg,
             sockets=[Socket(id="input", direction="input")]),
    ]
    wires = [Wire(from_=WireEndpoint(tool="src", socket="output"),
                  to=WireEndpoint(tool="dst", socket="input"))]
    meta = WorkflowMeta(name="fmt", description="", author="test", workflowId="wf-fmt",
                        created="2026-01-01T00:00:00Z")
    return Workflow(meta=meta, tools=tools, wires=wires)


async def _run_both(source_cfg: dict[str, Any], dest_cfg: dict[str, Any], tmp: Path) -> None:
    """Run the workflow via the engine and via its exported script."""
    name = Path(dest_cfg["destination"]).name
    for runner in ("engine", "script"):
        out_dir = tmp / runner
        out_dir.mkdir(exist_ok=True)
        cfg = {**dest_cfg, "destination": str(out_dir / name)}
        src = dict(source_cfg)
        if "{dir}" in src["source"]:
            src["source"] = src["source"].format(dir=out_dir)
        wf = _workflow(src, cfg)
        if runner == "engine":
            await WorkflowExecutor().execute_workflow(wf)
            continue
        code = PythonCodeGenerator(wf).generate()
        assert "# ERROR" not in code and "# TODO" not in code, code
        script = tmp / f"export_{name}.py"
        script.write_text(code)
        proc = subprocess.run([sys.executable, str(script)], capture_output=True, text=True,
                              timeout=120, check=False)
        assert proc.returncode == 0, proc.stderr


@pytest.mark.parametrize("fmt", list(FORMATS))
async def test_format_round_trip_matches_engine(fmt: str, tmp_path: Path):
    out_cfg, in_cfg = FORMATS[fmt]
    # 1. CSV fixture -> format
    await _run_both(
        {"type": "csv", "csvMode": "scan", "source": str(FIXTURE)},
        {**out_cfg, "destination": f"data.{fmt}"},
        tmp_path,
    )
    # 2. format -> CSV, reading what that runner wrote in step 1
    await _run_both(
        {**in_cfg, "source": f"{{dir}}/data.{fmt}"},
        {"type": "csv", "csvMode": "sink", "destination": "back.csv"},
        tmp_path,
    )
    engine = pl.read_csv(tmp_path / "engine" / "back.csv")
    script = pl.read_csv(tmp_path / "script" / "back.csv")
    assert engine.height == pl.read_csv(FIXTURE).height
    assert engine.equals(script)
