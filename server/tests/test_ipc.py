"""Tests for IPC/Arrow input/output functionality"""

from pathlib import Path

import polars as pl
import pytest

from app.domain.datasources.ipc import IPCDataSource
from app.domain.tools.implementations.input import InputTool
from app.domain.tools.implementations.output import OutputTool


@pytest.fixture
def sample_ipc(tmp_path: Path) -> Path:
    """Create a sample IPC/Arrow file for testing"""
    ipc_path = tmp_path / "test_data.arrow"

    # Create sample data
    df = pl.DataFrame(
        {
            "id": [1, 2, 3, 4, 5],
            "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
            "age": [25, 30, 35, 40, 45],
            "score": [85.5, 92.0, 78.3, 88.7, 95.2],
            "active": [True, True, False, True, False],
        }
    )

    # Write to IPC
    df.write_ipc(ipc_path)

    return ipc_path


@pytest.mark.asyncio
async def test_ipc_datasource_inspect(sample_ipc: Path):
    """Test IPCDataSource.inspect() returns correct schema"""
    datasource = IPCDataSource()

    schema = await datasource.inspect(str(sample_ipc), {})

    assert len(schema.columns) == 5
    assert schema.columns[0].name == "id"
    assert schema.columns[1].name == "name"
    assert schema.columns[2].name == "age"
    assert schema.columns[3].name == "score"
    assert schema.columns[4].name == "active"
    assert schema.file_size_bytes > 0


@pytest.mark.asyncio
async def test_ipc_datasource_preview(sample_ipc: Path):
    """Test IPCDataSource.preview() returns correct data"""
    datasource = IPCDataSource()

    preview = await datasource.preview(str(sample_ipc), {}, max_rows=3)

    assert preview.returned_rows == 3
    assert len(preview.data) == 3
    assert preview.data[0]["name"] == "Alice"
    assert preview.data[1]["age"] == 30
    assert preview.data[2]["score"] == 78.3


@pytest.mark.asyncio
async def test_ipc_input_tool_scan_mode(sample_ipc: Path):
    """Test InputTool with IPC in scan mode (lazy)"""
    tool = InputTool()

    config = {"type": "ipc", "source": str(sample_ipc), "ipcMode": "scan"}

    outputs = await tool.execute(config, {})

    assert "output" in outputs
    lf = outputs["output"]
    assert isinstance(lf, pl.LazyFrame)

    # Collect to verify data
    df = lf.collect()
    assert len(df) == 5
    assert df["name"][0] == "Alice"


@pytest.mark.asyncio
async def test_ipc_input_tool_read_mode(sample_ipc: Path):
    """Test InputTool with IPC in read mode (eager -> lazy)"""
    tool = InputTool()

    config = {"type": "ipc", "source": str(sample_ipc), "ipcMode": "read"}

    outputs = await tool.execute(config, {})

    assert "output" in outputs
    lf = outputs["output"]
    assert isinstance(lf, pl.LazyFrame)

    df = lf.collect()
    assert len(df) == 5


@pytest.mark.asyncio
async def test_ipc_input_with_column_selection(sample_ipc: Path):
    """Test InputTool with IPC selecting specific columns"""
    tool = InputTool()

    config = {
        "type": "ipc",
        "source": str(sample_ipc),
        "ipcMode": "scan",
        "columns": ["name", "age"],
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert df.columns == ["name", "age"]
    assert len(df) == 5


@pytest.mark.asyncio
async def test_ipc_input_with_n_rows(sample_ipc: Path):
    """Test InputTool with IPC limiting rows"""
    tool = InputTool()

    config = {"type": "ipc", "source": str(sample_ipc), "ipcMode": "scan", "n_rows": 2}

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert len(df) == 2
    assert df["name"][0] == "Alice"
    assert df["name"][1] == "Bob"


@pytest.mark.asyncio
async def test_ipc_output_tool_sink_mode(tmp_path: Path, sample_ipc: Path):
    """Test OutputTool with IPC in sink mode (streaming)"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Load test data
    input_config = {"type": "ipc", "source": str(sample_ipc), "ipcMode": "scan"}
    inputs = await input_tool.execute(input_config, {})

    # Write to new file
    output_path = tmp_path / "output.arrow"
    output_config = {"type": "ipc", "destination": str(output_path), "ipcMode": "sink"}
    await output_tool.execute(output_config, {"input": inputs["output"]})

    # Verify output file exists and has correct data
    assert output_path.exists()
    result = pl.read_ipc(output_path)
    assert len(result) == 5
    assert result["name"][0] == "Alice"


@pytest.mark.asyncio
async def test_ipc_output_tool_write_mode(tmp_path: Path, sample_ipc: Path):
    """Test OutputTool with IPC in write mode (eager)"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Load test data
    input_config = {"type": "ipc", "source": str(sample_ipc), "ipcMode": "scan"}
    inputs = await input_tool.execute(input_config, {})

    # Write to new file
    output_path = tmp_path / "output_eager.arrow"
    output_config = {"type": "ipc", "destination": str(output_path), "ipcMode": "write"}
    await output_tool.execute(output_config, {"input": inputs["output"]})

    # Verify output file exists and has correct data
    assert output_path.exists()
    result = pl.read_ipc(output_path)
    assert len(result) == 5


@pytest.mark.asyncio
async def test_ipc_output_with_compression(tmp_path: Path, sample_ipc: Path):
    """Test OutputTool with IPC using compression"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Load test data
    input_config = {"type": "ipc", "source": str(sample_ipc), "ipcMode": "scan"}
    inputs = await input_tool.execute(input_config, {})

    # Write with zstd compression
    output_path = tmp_path / "output_compressed.arrow"
    output_config = {
        "type": "ipc",
        "destination": str(output_path),
        "ipcMode": "sink",
        "compression": "zstd",
    }
    await output_tool.execute(output_config, {"input": inputs["output"]})

    # Verify output file exists and has correct data
    assert output_path.exists()
    result = pl.read_ipc(output_path)
    assert len(result) == 5


@pytest.mark.asyncio
async def test_ipc_roundtrip_all_extensions(tmp_path: Path):
    """Test IPC roundtrip with all supported extensions"""
    df = pl.DataFrame({"id": [1, 2, 3], "value": ["a", "b", "c"]})

    extensions = [".arrow", ".ipc", ".feather"]

    for ext in extensions:
        file_path = tmp_path / f"test{ext}"

        # Write using Polars directly
        df.write_ipc(file_path)

        # Read using our datasource
        datasource = IPCDataSource()
        schema = await datasource.inspect(str(file_path), {})

        assert len(schema.columns) == 2
        assert schema.columns[0].name == "id"
        assert schema.columns[1].name == "value"


@pytest.mark.asyncio
async def test_ipc_with_row_index(sample_ipc: Path):
    """Test InputTool with IPC adding row index"""
    tool = InputTool()

    config = {
        "type": "ipc",
        "source": str(sample_ipc),
        "ipcMode": "scan",
        "row_index_name": "row_nr",
        "row_index_offset": 1,
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert "row_nr" in df.columns
    assert df["row_nr"][0] == 1
    assert df["row_nr"][4] == 5


@pytest.mark.asyncio
async def test_ipc_datasource_validate_config():
    """Test IPCDataSource.validate_config()"""
    datasource = IPCDataSource()

    # Valid config
    errors = await datasource.validate_config({})
    assert len(errors) == 0

    # Invalid n_rows
    errors = await datasource.validate_config({"n_rows": -1})
    assert len(errors) == 1
    assert "n_rows" in errors[0]

    # Invalid row_index_offset
    errors = await datasource.validate_config({"row_index_offset": -1})
    assert len(errors) == 1
    assert "row_index_offset" in errors[0]

    # Invalid retries
    errors = await datasource.validate_config({"retries": -1})
    assert len(errors) == 1
    assert "retries" in errors[0]


@pytest.mark.asyncio
async def test_ipc_output_creates_parent_dirs(tmp_path: Path, sample_ipc: Path):
    """Test OutputTool creates parent directories if they don't exist"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Load test data
    input_config = {"type": "ipc", "source": str(sample_ipc), "ipcMode": "scan"}
    inputs = await input_tool.execute(input_config, {})

    # Write to nested path that doesn't exist
    output_path = tmp_path / "nested" / "dir" / "output.arrow"
    output_config = {"type": "ipc", "destination": str(output_path), "ipcMode": "sink"}
    await output_tool.execute(output_config, {"input": inputs["output"]})

    # Verify file was created
    assert output_path.exists()
    result = pl.read_ipc(output_path)
    assert len(result) == 5


# -----------------------------------------------------------------------------
# Code Generation Tests
# -----------------------------------------------------------------------------


def test_ipc_input_code_generation_scan():
    """Test code generation for IPC input with scan mode"""
    tool = InputTool()

    config = {"type": "ipc", "source": "/data/input.arrow", "ipcMode": "scan"}

    lines, output_vars = tool.to_python_code("input_1", config, {})

    code = "\n".join(lines)
    assert "scan_ipc" in code
    assert "/data/input.arrow" in code
    assert "output" in output_vars


def test_ipc_input_code_generation_read():
    """Test code generation for IPC input with read mode"""
    tool = InputTool()

    config = {"type": "ipc", "source": "/data/input.feather", "ipcMode": "read"}

    lines, output_vars = tool.to_python_code("input_1", config, {})

    code = "\n".join(lines)
    assert "read_ipc" in code
    assert "/data/input.feather" in code
    assert ".lazy()" in code  # Should convert to lazy after read


def test_ipc_input_code_generation_with_options():
    """Test code generation for IPC input with options"""
    tool = InputTool()

    config = {
        "type": "ipc",
        "source": "/data/input.arrow",
        "ipcMode": "scan",
        "n_rows": 100,
        "memory_map": True,
        "row_index_name": "idx",
    }

    lines, output_vars = tool.to_python_code("input_1", config, {})

    code = "\n".join(lines)
    assert "scan_ipc" in code
    assert "n_rows=100" in code
    assert "memory_map=True" in code
    assert 'row_index_name="idx"' in code


def test_ipc_output_code_generation_sink():
    """Test code generation for IPC output with sink mode"""
    tool = OutputTool()

    config = {"type": "ipc", "destination": "/data/output.arrow", "ipcMode": "sink"}

    lines, output_vars = tool.to_python_code("output_1", config, {"input": "df"})

    code = "\n".join(lines)
    assert "sink_ipc" in code
    assert "/data/output.arrow" in code


def test_ipc_output_code_generation_write():
    """Test code generation for IPC output with write mode"""
    tool = OutputTool()

    config = {"type": "ipc", "destination": "/data/output.ipc", "ipcMode": "write"}

    lines, output_vars = tool.to_python_code("output_1", config, {"input": "df"})

    code = "\n".join(lines)
    assert "write_ipc" in code
    assert ".collect()" in code  # Should collect before write
    assert "/data/output.ipc" in code


def test_ipc_output_code_generation_with_compression():
    """Test code generation for IPC output with compression"""
    tool = OutputTool()

    config = {
        "type": "ipc",
        "destination": "/data/output.arrow",
        "ipcMode": "sink",
        "compression": "zstd",
    }

    lines, output_vars = tool.to_python_code("output_1", config, {"input": "df"})

    code = "\n".join(lines)
    assert "sink_ipc" in code
    assert 'compression="zstd"' in code
