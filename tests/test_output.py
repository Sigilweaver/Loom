"""Tests for Output tool"""

import polars as pl
import pytest
from pathlib import Path

from app.api.models.workflow import Workflow, Tool, Wire, WireEndpoint, WorkflowMeta
from app.domain.execution.executor import WorkflowExecutor
from app.domain.tools.registry import ToolRegistry


@pytest.mark.asyncio
async def test_output_csv_sink(tmp_path: Path, sample_csv: Path):
    """Test CSV output using sink_csv (streaming mode)"""
    output_file = tmp_path / "output.csv"

    # Create workflow: Input -> Output
    workflow = Workflow(
        tools=[
            Tool(
                id="input1",
                type="Input",
                x=0,
                y=0,
                config={
                    "type": "csv",
                    "source": str(sample_csv),
                    "csvMode": "scan",
                },
                sockets=[],
            ),
            Tool(
                id="output1",
                type="Output",
                x=100,
                y=0,
                config={
                    "type": "csv",
                    "destination": str(output_file),
                    "csvMode": "sink",  # Streaming mode
                    "include_header": True,
                },
                sockets=[],
            ),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="input1", socket=0), to=WireEndpoint(tool="output1", socket=0)),
        ],
        meta=WorkflowMeta(name="Test CSV Output Sink"),
    )

    # Execute workflow
    executor = WorkflowExecutor(workflow)
    result = await executor.execute()

    # Verify output file was created
    assert output_file.exists()

    # Verify content matches input
    output_df = pl.read_csv(output_file)
    input_df = pl.read_csv(sample_csv)
    assert output_df.shape == input_df.shape
    assert output_df.columns == input_df.columns


@pytest.mark.asyncio
async def test_output_csv_write(tmp_path: Path, sample_csv: Path):
    """Test CSV output using write_csv (eager mode)"""
    output_file = tmp_path / "output_write.csv"

    # Create workflow: Input -> Output
    workflow = Workflow(
        tools=[
            Tool(id="input1", type="Input", x=0, y=0, config={
                    "type": "csv",
                    "source": str(sample_csv),
                    "csvMode": "scan",
                },
            sockets=[],
            ),
            Tool(id="output1", type="Output", x=0, y=0, config={
                    "type": "csv",
                    "destination": str(output_file),
                    "csvMode": "write",  # Eager mode
                    "include_header": True,
                    "separator": ",",
                },
            sockets=[],
            ),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="input1", socket=0), to=WireEndpoint(tool="output1", socket=0)),
        ],
        meta=WorkflowMeta(name="Test CSV Output Write"),
    )

    # Execute workflow
    executor = WorkflowExecutor(workflow)
    result = await executor.execute()

    # Verify output file was created
    assert output_file.exists()

    # Verify content
    output_df = pl.read_csv(output_file)
    assert len(output_df) > 0


@pytest.mark.asyncio
async def test_output_creates_directory(tmp_path: Path, sample_csv: Path):
    """Test that output creates parent directories if they don't exist"""
    output_file = tmp_path / "subdir" / "nested" / "output.csv"

    workflow = Workflow(
        tools=[
            Tool(id="input1", type="Input", x=0, y=0, config={
                    "type": "csv",
                    "source": str(sample_csv),
                    "csvMode": "scan",
                },
            sockets=[],
            ),
            Tool(id="output1", type="Output", x=0, y=0, config={
                    "type": "csv",
                    "destination": str(output_file),
                    "csvMode": "sink",
                },
            sockets=[],
            ),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="input1", socket=0), to=WireEndpoint(tool="output1", socket=0)),
        ],
        meta=WorkflowMeta(name="Test Directory Creation"),
    )

    # Execute workflow
    executor = WorkflowExecutor(workflow)
    await executor.execute()

    # Verify nested directories were created
    assert output_file.exists()
    assert output_file.parent.exists()


@pytest.mark.asyncio
async def test_output_with_custom_separator(tmp_path: Path, sample_csv: Path):
    """Test CSV output with custom separator"""
    output_file = tmp_path / "output_tsv.tsv"

    workflow = Workflow(
        tools=[
            Tool(id="input1", type="Input", x=0, y=0, config={
                    "type": "csv",
                    "source": str(sample_csv),
                    "csvMode": "scan",
                },
            sockets=[],
            ),
            Tool(id="output1", type="Output", x=0, y=0, config={
                    "type": "csv",
                    "destination": str(output_file),
                    "csvMode": "sink",
                    "separator": "\t",  # Tab-separated
                    "include_header": True,
                },
            sockets=[],
            ),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="input1", socket=0), to=WireEndpoint(tool="output1", socket=0)),
        ],
        meta=WorkflowMeta(name="Test TSV Output"),
    )

    # Execute workflow
    executor = WorkflowExecutor(workflow)
    await executor.execute()

    # Verify file was created and has tab separator
    assert output_file.exists()
    output_df = pl.read_csv(output_file, separator="\t")
    assert len(output_df) > 0


@pytest.mark.asyncio
async def test_output_validation():
    """Test output tool configuration validation"""
    tool_class = ToolRegistry.get("Output")

    # Missing type
    errors = await tool_class.validate_config({"destination": "/tmp/out.csv"})
    assert any("type" in err.lower() for err in errors)

    # Missing destination
    errors = await tool_class.validate_config({"type": "csv"})
    assert any("destination" in err.lower() for err in errors)

    # Invalid output type
    errors = await tool_class.validate_config({
        "type": "invalid",
        "destination": "/tmp/out.csv"
    })
    assert any("unsupported" in err.lower() for err in errors)

    # Invalid CSV mode
    errors = await tool_class.validate_config({
        "type": "csv",
        "destination": "/tmp/out.csv",
        "csvMode": "invalid"
    })
    assert any("mode" in err.lower() for err in errors)

    # Valid config
    errors = await tool_class.validate_config({
        "type": "csv",
        "destination": "/tmp/out.csv",
        "csvMode": "sink"
    })
    assert len(errors) == 0


@pytest.mark.asyncio
async def test_output_in_workflow_pipeline(tmp_path: Path, sample_csv: Path):
    """Test output at the end of a processing pipeline"""
    output_file = tmp_path / "filtered_output.csv"

    # Create workflow: Input -> Filter -> Output
    workflow = Workflow(
        tools=[
            Tool(id="input1", type="Input", x=0, y=0, config={
                    "type": "csv",
                    "source": str(sample_csv),
                    "csvMode": "scan",
                },
            sockets=[],
            ),
            Tool(id="filter1", type="Filter", x=0, y=0, config={
                    "expression": "pl.col('age') > 25",
                },
            sockets=[],
            ),
            Tool(id="output1", type="Output", x=0, y=0, config={
                    "type": "csv",
                    "destination": str(output_file),
                    "csvMode": "sink",
                    "include_header": True,
                },
            sockets=[],
            ),
        ],
        wires=[
            Wire(from_=WireEndpoint(tool="input1", socket=0), to=WireEndpoint(tool="filter1", socket=0)),
            Wire(
                id="wire2",
                from_tool="filter1",
                from_socket=1,  # True output
                to_tool="output1",
                to_socket=0,
            ),
        ],
        meta=WorkflowMeta(name="Test Pipeline with Output"),
    )

    # Execute workflow
    executor = WorkflowExecutor(workflow)
    await executor.execute()

    # Verify output file was created and contains filtered data
    assert output_file.exists()
    output_df = pl.read_csv(output_file)
    
    # All ages should be > 25
    assert (output_df["age"] > 25).all()
