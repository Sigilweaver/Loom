"""Tests for Output tool"""

from pathlib import Path

import polars as pl
import pytest

from app.api.models.workflow import Socket, Tool, Wire, WireEndpoint, Workflow, WorkflowMeta
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
                sockets=[Socket(id="output", direction="output")],
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
                sockets=[Socket(id="input", direction="input")],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="output1", socket="input"),
            ),
        ],
        meta=WorkflowMeta(
            name="Test CSV Output Sink",
            description="Test",
            author="Test",
            workflowId="test-sink",
            created="2025-08-01",
        ),
    )

    # Execute workflow
    executor = WorkflowExecutor()
    await executor.execute_workflow(workflow)

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
            sockets=[Socket(id="output", direction="output")],
            ),
            Tool(id="output1", type="Output", x=0, y=0, config={
                    "type": "csv",
                    "destination": str(output_file),
                    "csvMode": "write",  # Eager mode
                    "include_header": True,
                    "separator": ",",
                },
            sockets=[Socket(id="input", direction="input")],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="output1", socket="input"),
            ),
        ],
        meta=WorkflowMeta(
            name="Test CSV Output Write",
            description="Test",
            author="Test",
            workflowId="test-write",
            created="2025-08-01",
        ),
    )

    # Execute workflow
    executor = WorkflowExecutor()
    await executor.execute_workflow(workflow)

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
            sockets=[Socket(id="output", direction="output")],
            ),
            Tool(id="output1", type="Output", x=0, y=0, config={
                    "type": "csv",
                    "destination": str(output_file),
                    "csvMode": "sink",
                },
            sockets=[Socket(id="input", direction="input")],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="output1", socket="input"),
            ),
        ],
        meta=WorkflowMeta(
            name="Test Directory Creation",
            description="Test",
            author="Test",
            workflowId="test-dir",
            created="2025-08-01",
        ),
    )

    # Execute workflow
    executor = WorkflowExecutor()
    await executor.execute_workflow(workflow)

    # Verify output file was created
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
            sockets=[Socket(id="output", direction="output")],
            ),
            Tool(id="output1", type="Output", x=0, y=0, config={
                    "type": "csv",
                    "destination": str(output_file),
                    "csvMode": "sink",
                    "separator": "\t",  # Tab-separated
                    "include_header": True,
                },
            sockets=[Socket(id="input", direction="input")],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="output1", socket="input"),
            ),
        ],
        meta=WorkflowMeta(
            name="Test TSV Output",
            description="Test",
            author="Test",
            workflowId="test-tsv",
            created="2025-08-01",
        ),
    )

    # Execute workflow
    executor = WorkflowExecutor()
    await executor.execute_workflow(workflow)

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
            sockets=[Socket(id="output", direction="output")],
            ),
            Tool(id="filter1", type="Filter", x=0, y=0, config={
                    "expression": "pl.col('age') > 25",
                },
            sockets=[
                Socket(id="input", direction="input"),
                Socket(id="output-true", direction="output"),  # T output
                Socket(id="output-false", direction="output"),  # F output
            ],
            ),
            Tool(id="output1", type="Output", x=0, y=0, config={
                    "type": "csv",
                    "destination": str(output_file),
                    "csvMode": "sink",
                    "include_header": True,
                },
            sockets=[Socket(id="input", direction="input")],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="filter1", socket="input"),
            ),
            Wire(
                from_=WireEndpoint(tool="filter1", socket="output-true"),
                to=WireEndpoint(tool="output1", socket="input"),
            ),
        ],
        meta=WorkflowMeta(
            name="Test Pipeline with Output",
            description="Test",
            author="Test",
            workflowId="test-pipeline",
            created="2025-08-01",
        ),
    )

    # Execute workflow
    executor = WorkflowExecutor()
    await executor.execute_workflow(workflow)

    # Verify output file was created and contains filtered data
    assert output_file.exists()
    output_df = pl.read_csv(output_file)

    # All ages should be > 25
    assert (output_df["age"] > 25).all()


# ============================================================================
# Excel Output Tests
# ============================================================================


@pytest.mark.asyncio
async def test_output_excel_basic(tmp_path: Path, sample_csv: Path):
    """Test basic Excel output"""
    output_file = tmp_path / "output.xlsx"

    # Create workflow: Input -> Output (Excel)
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
                sockets=[Socket(id="output", direction="output")],
            ),
            Tool(
                id="output1",
                type="Output",
                x=100,
                y=0,
                config={
                    "type": "excel",
                    "destination": str(output_file),
                },
                sockets=[Socket(id="input", direction="input")],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="output1", socket="input"),
            ),
        ],
        meta=WorkflowMeta(
            name="Test Excel Output",
            description="Test",
            author="Test",
            workflowId="test-excel",
            created="2025-08-01",
        ),
    )

    # Execute workflow
    executor = WorkflowExecutor()
    await executor.execute_workflow(workflow)

    # Verify output file was created
    assert output_file.exists()

    # Verify content matches input
    output_df = pl.read_excel(output_file)
    input_df = pl.read_csv(sample_csv)
    assert output_df.shape == input_df.shape
    assert output_df.columns == input_df.columns


@pytest.mark.asyncio
async def test_output_excel_with_options(tmp_path: Path, sample_csv: Path):
    """Test Excel output with various options"""
    output_file = tmp_path / "output_styled.xlsx"

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
                sockets=[Socket(id="output", direction="output")],
            ),
            Tool(
                id="output1",
                type="Output",
                x=100,
                y=0,
                config={
                    "type": "excel",
                    "destination": str(output_file),
                    "worksheet": "Data",
                    "table_style": "Table Style Light 1",
                    "include_header": True,
                    "autofit": True,
                    "autofilter": True,
                    "float_precision": 2,
                },
                sockets=[Socket(id="input", direction="input")],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="output1", socket="input"),
            ),
        ],
        meta=WorkflowMeta(
            name="Test Excel Output with Options",
            description="Test",
            author="Test",
            workflowId="test-excel-opts",
            created="2025-08-01",
        ),
    )

    # Execute workflow
    executor = WorkflowExecutor()
    await executor.execute_workflow(workflow)

    # Verify output file was created
    assert output_file.exists()

    # Read back and verify data is present
    output_df = pl.read_excel(output_file, sheet_name="Data")
    assert len(output_df) > 0


@pytest.mark.asyncio
async def test_output_excel_no_table_style(tmp_path: Path, sample_csv: Path):
    """Test Excel output with table style disabled"""
    output_file = tmp_path / "output_no_style.xlsx"

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
                sockets=[Socket(id="output", direction="output")],
            ),
            Tool(
                id="output1",
                type="Output",
                x=100,
                y=0,
                config={
                    "type": "excel",
                    "destination": str(output_file),
                    "table_style": None,  # Disable table styling
                },
                sockets=[Socket(id="input", direction="input")],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="output1", socket="input"),
            ),
        ],
        meta=WorkflowMeta(
            name="Test Excel Output No Style",
            description="Test",
            author="Test",
            workflowId="test-excel-no-style",
            created="2025-08-01",
        ),
    )

    # Execute workflow
    executor = WorkflowExecutor()
    await executor.execute_workflow(workflow)

    # Verify output file was created
    assert output_file.exists()


@pytest.mark.asyncio
async def test_output_excel_validation():
    """Test Excel output configuration validation"""
    tool_class = ToolRegistry.get("Output")

    # Valid Excel config
    errors = await tool_class.validate_config({
        "type": "excel",
        "destination": "/tmp/out.xlsx",
    })
    assert len(errors) == 0

    # Invalid sheet_zoom (too low)
    errors = await tool_class.validate_config({
        "type": "excel",
        "destination": "/tmp/out.xlsx",
        "sheet_zoom": 5,  # Min is 10
    })
    assert any("sheet_zoom" in err.lower() for err in errors)

    # Invalid sheet_zoom (too high)
    errors = await tool_class.validate_config({
        "type": "excel",
        "destination": "/tmp/out.xlsx",
        "sheet_zoom": 500,  # Max is 400
    })
    assert any("sheet_zoom" in err.lower() for err in errors)

    # Invalid float_precision
    errors = await tool_class.validate_config({
        "type": "excel",
        "destination": "/tmp/out.xlsx",
        "float_precision": 20,  # Max is 15
    })
    assert any("float_precision" in err.lower() for err in errors)

    # Valid sheet_zoom and float_precision
    errors = await tool_class.validate_config({
        "type": "excel",
        "destination": "/tmp/out.xlsx",
        "sheet_zoom": 150,
        "float_precision": 5,
    })
    assert len(errors) == 0


@pytest.mark.asyncio
async def test_output_excel_freeze_panes(tmp_path: Path, sample_csv: Path):
    """Test Excel output with freeze panes"""
    output_file = tmp_path / "output_freeze.xlsx"

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
                sockets=[Socket(id="output", direction="output")],
            ),
            Tool(
                id="output1",
                type="Output",
                x=100,
                y=0,
                config={
                    "type": "excel",
                    "destination": str(output_file),
                    "freeze_panes": "A2",  # Freeze top row
                },
                sockets=[Socket(id="input", direction="input")],
            ),
        ],
        wires=[
            Wire(
                from_=WireEndpoint(tool="input1", socket="output"),
                to=WireEndpoint(tool="output1", socket="input"),
            ),
        ],
        meta=WorkflowMeta(
            name="Test Excel Output Freeze Panes",
            description="Test",
            author="Test",
            workflowId="test-excel-freeze",
            created="2025-08-01",
        ),
    )

    # Execute workflow
    executor = WorkflowExecutor()
    await executor.execute_workflow(workflow)

    # Verify output file was created
    assert output_file.exists()


def test_output_excel_to_python_code():
    """Test OutputTool.to_python_code() for Excel"""
    from app.domain.tools.implementations.output import OutputTool

    tool = OutputTool()

    config = {
        "type": "excel",
        "destination": "/tmp/output.xlsx",
        "worksheet": "Results",
        "table_style": "Table Style Medium 9",
        "autofit": True,
        "include_header": True,
    }

    lines, output_vars = tool.to_python_code("output_1", config, {"input": "df_input"})

    assert len(lines) >= 1
    assert "write_excel" in lines[0]
    assert "/tmp/output.xlsx" in lines[0]
    assert "worksheet" in lines[0]
    assert "autofit=True" in lines[0]
    assert len(output_vars) == 0  # Output tools have no outputs
