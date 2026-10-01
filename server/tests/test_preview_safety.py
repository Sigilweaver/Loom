"""Previews must never create or overwrite Output destinations."""

from pathlib import Path

import pytest

from app.config import settings
from app.domain.execution.executor import WorkflowExecutor
from app.domain.models.workflow import Socket, Tool, Wire, WireEndpoint, Workflow, WorkflowMeta
from app.utils.errors import ExecutionError


def _workflow(tmp_path: Path, *, configured: bool = True) -> Workflow:
    source = tmp_path / "source.csv"
    source.write_text("a\n1\n2\n3\n")
    return Workflow(
        meta=WorkflowMeta(
            name="Preview safety", description="", author="Test",
            workflowId=f"preview-{tmp_path.name}", created="2026-09-30",
        ),
        tools=[
            Tool(
                id="read", type="Input", x=0, y=0,
                config={"category": "file", "type": "csv", "source": str(source)},
                sockets=[Socket(id="output", direction="output")],
            ),
            Tool(
                id="write", type="Output", x=1, y=0,
                config={"type": "csv", "destination": str(tmp_path / "destination.csv")}
                if configured else {},
                sockets=[Socket(id="input", direction="input")],
            ),
        ],
        wires=[Wire(from_=WireEndpoint(tool="read", socket="output"),
                    to=WireEndpoint(tool="write", socket="input"))],
    )


@pytest.mark.parametrize("execution_mode", ["sequential", "parallel"])
@pytest.mark.parametrize("existing", [False, True])
@pytest.mark.parametrize("writer_type", ["Output", "core/polars::Output"])
async def test_preview_all_never_writes_outputs(
    tmp_path, monkeypatch, execution_mode, existing, writer_type,
):
    monkeypatch.setattr(settings, "execution_mode", execution_mode)
    workflow = _workflow(tmp_path)
    workflow.tools[1].type = writer_type
    destination = tmp_path / "destination.csv"
    if existing:
        destination.write_text("keep this file\n")

    result = await WorkflowExecutor().preview_all_tools(workflow, preview_limit=2)

    assert result["tools"]["read"]["outputs"]["output"]["data"] == [{"a": 1}, {"a": 2}]
    assert result["tools"]["write"] == {"outputs": {}}
    if existing:
        assert destination.read_text() == "keep this file\n"
    else:
        assert not destination.exists()


async def test_preview_all_allows_an_unconfigured_writer(tmp_path):
    result = await WorkflowExecutor().preview_all_tools(_workflow(tmp_path, configured=False))
    assert result["tools"]["read"]["outputs"]["output"]["row_count"] == 3
    assert not (tmp_path / "destination.csv").exists()


@pytest.mark.parametrize("operation", ["socket", "profile"])
async def test_previewing_a_writer_does_not_write(tmp_path, operation):
    workflow = _workflow(tmp_path)
    executor = WorkflowExecutor()
    # Output has no output socket; a crafted request must fail before any write.
    with pytest.raises(ExecutionError):
        if operation == "socket":
            await executor.execute_single_tool(workflow, "write", "output", preview_limit=2)
        else:
            await executor.profile_columns(workflow, "write", "output")
    assert not (tmp_path / "destination.csv").exists()


async def test_run_still_writes_all_rows(tmp_path):
    await WorkflowExecutor().execute_workflow(_workflow(tmp_path), preview_limit=1)
    assert (tmp_path / "destination.csv").read_text() == "a\n1\n2\n3\n"
