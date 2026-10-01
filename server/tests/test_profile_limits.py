"""Profiling must bound collection and include statistics in its request budget."""

import threading

import polars as pl
import pytest
from pydantic import ValidationError

from app.config import Settings
from app.domain.execution import executor as executor_mod
from app.domain.execution.executor import WorkflowExecutor
from app.domain.models.workflow import Socket, Tool, Workflow, WorkflowMeta
from app.domain.profiling.profiler import ColumnProfiler
from app.utils.errors import ExecutionTimeoutError


@pytest.fixture
def workflow(tmp_path, monkeypatch):
    monkeypatch.setattr(executor_mod.settings, "cache_enabled", False)
    monkeypatch.setattr(executor_mod.settings, "max_profile_rows", 3)
    source = tmp_path / "source.csv"
    pl.DataFrame({"a": range(2000)}).write_csv(source)
    return Workflow(
        meta=WorkflowMeta(
            name="bounded profile", author="test", description="",
            workflowId="bounded-profile", created="2025-01-01",
        ),
        tools=[Tool(
            id="read", type="Input", x=0, y=0,
            config={"category": "file", "type": "csv", "source": str(source)},
            sockets=[Socket(id="output", direction="output")],
        )],
        wires=[],
    )


async def test_large_profile_reports_sample_statistics(workflow):
    result = await WorkflowExecutor().profile_columns(workflow, "read", "output")
    assert result["row_count"] == 3
    assert result["sampled"] is True
    assert result["sample_limit"] == 3
    assert result["columns"]["a"]["count"] == 3
    assert result["columns"]["a"]["max"] == 2


def test_http_profile_preserves_sampling_metadata(workflow, client):
    response = client.post("/api/workflow/tool/profile", json={
        "workflow": workflow.model_dump(mode="json", by_alias=True),
        "tool_id": "read", "socket_id": "output",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["row_count"] == 3
    assert data["sampled"] is True
    assert data["sample_limit"] == 3


@pytest.mark.parametrize("rows", [0, 2, 3])
async def test_profile_does_not_label_complete_data_sampled(workflow, monkeypatch, rows):
    source = workflow.tools[0].config["source"]
    pl.DataFrame({"a": pl.Series(range(rows), dtype=pl.Int64)}).write_csv(source)
    result = await WorkflowExecutor().profile_columns(workflow, "read", "output")
    assert result["row_count"] == rows
    assert result["sampled"] is False


async def test_profile_pushes_limit_before_materialization(workflow, monkeypatch):
    seen = []
    original = pl.LazyFrame.collect

    def bounded_collect(frame, *args, **kwargs):
        df = original(frame, *args, **kwargs)
        seen.append(len(df))
        assert len(df) <= 4, "profiling materialized the complete source"
        return df

    monkeypatch.setattr(pl.LazyFrame, "collect", bounded_collect)
    result = await WorkflowExecutor().profile_columns(workflow, "read", "output")
    assert result["row_count"] == 3
    assert seen and max(seen) == 4


async def test_profile_statistics_obey_timeout_without_blocking_event_loop(workflow, monkeypatch):
    released = threading.Event()
    entered = threading.Event()
    original = ColumnProfiler.profile_columns

    def held_statistics(self, df, columns):
        entered.set()
        released.wait(timeout=1)
        return original(self, df, columns)

    monkeypatch.setattr(ColumnProfiler, "profile_columns", held_statistics)
    monkeypatch.setattr(executor_mod.settings, "max_execution_time_seconds", 0.1)
    try:
        with pytest.raises(ExecutionTimeoutError, match="profiling"):
            await WorkflowExecutor().profile_columns(workflow, "read", "output")
        assert entered.is_set()
    finally:
        released.set()


@pytest.mark.parametrize("limit", [0, -1])
def test_profile_limit_cannot_disable_bound(limit):
    with pytest.raises(ValidationError):
        Settings(max_profile_rows=limit)
