"""Tests for JSON/NDJSON input/output functionality"""

from pathlib import Path

import polars as pl
import pytest

from app.domain.datasources.json import JSONDataSource
from app.domain.tools.implementations.input import InputTool
from app.domain.tools.implementations.output import OutputTool

# -----------------------------------------------------------------------------
# Fixtures
# -----------------------------------------------------------------------------


@pytest.fixture
def sample_json(tmp_path: Path) -> Path:
    """Create a sample standard JSON file for testing"""
    json_path = tmp_path / "test_data.json"

    # Create sample data as array of objects
    df = pl.DataFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "age": [25, 30, 35, 40, 45],
        "score": [85.5, 92.0, 78.3, 88.7, 95.2],
        "active": [True, True, False, True, False]
    })

    # Write to JSON (standard format)
    df.write_json(json_path)

    return json_path


@pytest.fixture
def sample_ndjson(tmp_path: Path) -> Path:
    """Create a sample NDJSON file for testing"""
    ndjson_path = tmp_path / "test_data.ndjson"

    df = pl.DataFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "age": [25, 30, 35, 40, 45],
        "score": [85.5, 92.0, 78.3, 88.7, 95.2],
        "active": [True, True, False, True, False]
    })

    # Write to NDJSON
    df.write_ndjson(ndjson_path)

    return ndjson_path


@pytest.fixture
def nested_json(tmp_path: Path) -> Path:
    """Create a JSON file with nested structures"""
    json_path = tmp_path / "nested.json"

    # Write nested JSON manually since Polars can't handle nested writes
    import json
    data = [
        {"id": 1, "user": {"name": "Alice", "email": "alice@test.com"}, "tags": ["a", "b"]},
        {"id": 2, "user": {"name": "Bob", "email": "bob@test.com"}, "tags": ["c"]},
    ]
    with open(json_path, "w") as f:
        json.dump(data, f)

    return json_path


@pytest.fixture
def jsonl_file(tmp_path: Path) -> Path:
    """Create a .jsonl file (should be treated as NDJSON)"""
    jsonl_path = tmp_path / "test_data.jsonl"

    df = pl.DataFrame({
        "id": [1, 2, 3],
        "value": [10.0, 20.0, 30.0]
    })

    df.write_ndjson(jsonl_path)

    return jsonl_path


# -----------------------------------------------------------------------------
# DataSource Tests
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_json_datasource_inspect_standard(sample_json: Path):
    """Test JSONDataSource.inspect() with standard JSON"""
    datasource = JSONDataSource()

    schema = await datasource.inspect(str(sample_json), {})

    assert len(schema.columns) == 5
    col_names = [c.name for c in schema.columns]
    assert "id" in col_names
    assert "name" in col_names
    assert "age" in col_names
    assert "score" in col_names
    assert "active" in col_names
    assert schema.file_size_bytes > 0


@pytest.mark.asyncio
async def test_json_datasource_inspect_ndjson(sample_ndjson: Path):
    """Test JSONDataSource.inspect() with NDJSON"""
    datasource = JSONDataSource()

    schema = await datasource.inspect(str(sample_ndjson), {})

    assert len(schema.columns) == 5
    col_names = [c.name for c in schema.columns]
    assert "id" in col_names
    assert "name" in col_names
    assert schema.file_size_bytes > 0


@pytest.mark.asyncio
async def test_json_datasource_preview_standard(sample_json: Path):
    """Test JSONDataSource.preview() with standard JSON"""
    datasource = JSONDataSource()

    preview = await datasource.preview(str(sample_json), {}, max_rows=3)

    assert preview.returned_rows == 3
    assert len(preview.data) == 3
    assert preview.data[0]["name"] == "Alice"


@pytest.mark.asyncio
async def test_json_datasource_preview_ndjson(sample_ndjson: Path):
    """Test JSONDataSource.preview() with NDJSON"""
    datasource = JSONDataSource()

    preview = await datasource.preview(str(sample_ndjson), {}, max_rows=3)

    assert preview.returned_rows == 3
    assert len(preview.data) == 3
    assert preview.data[0]["name"] == "Alice"


@pytest.mark.asyncio
async def test_json_datasource_nested(nested_json: Path):
    """Test JSONDataSource handles nested structures"""
    datasource = JSONDataSource()

    schema = await datasource.inspect(str(nested_json), {})

    # Should have columns for nested structures
    col_names = [c.name for c in schema.columns]
    assert "id" in col_names
    assert "user" in col_names
    assert "tags" in col_names


# -----------------------------------------------------------------------------
# InputTool Tests - Standard JSON
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_json_input_tool_read_mode(sample_json: Path):
    """Test InputTool with standard JSON in read mode (only option)"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": str(sample_json),
        "jsonMode": "read"  # Standard JSON only supports read
    }

    outputs = await tool.execute(config, {})

    assert "output" in outputs
    lf = outputs["output"]
    assert isinstance(lf, pl.LazyFrame)

    df = lf.collect()
    assert len(df) == 5
    assert df["name"][0] == "Alice"


@pytest.mark.asyncio
async def test_json_input_tool_auto_detects_format(sample_json: Path):
    """Test InputTool auto-detects standard JSON format"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": str(sample_json)
        # No jsonMode specified, should default based on extension
    }

    outputs = await tool.execute(config, {})

    assert "output" in outputs
    df = outputs["output"].collect()
    assert len(df) == 5


# -----------------------------------------------------------------------------
# InputTool Tests - NDJSON
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ndjson_input_tool_scan_mode(sample_ndjson: Path):
    """Test InputTool with NDJSON in scan mode (lazy)"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": str(sample_ndjson),
        "jsonMode": "scan"
    }

    outputs = await tool.execute(config, {})

    assert "output" in outputs
    lf = outputs["output"]
    assert isinstance(lf, pl.LazyFrame)

    df = lf.collect()
    assert len(df) == 5
    assert df["name"][0] == "Alice"


@pytest.mark.asyncio
async def test_ndjson_input_tool_read_mode(sample_ndjson: Path):
    """Test InputTool with NDJSON in read mode (eager -> lazy)"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": str(sample_ndjson),
        "jsonMode": "read"
    }

    outputs = await tool.execute(config, {})

    assert "output" in outputs
    lf = outputs["output"]
    assert isinstance(lf, pl.LazyFrame)

    df = lf.collect()
    assert len(df) == 5


@pytest.mark.asyncio
async def test_jsonl_input_treated_as_ndjson(jsonl_file: Path):
    """Test that .jsonl files are treated as NDJSON"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": str(jsonl_file),
        "jsonMode": "scan"
    }

    outputs = await tool.execute(config, {})

    assert "output" in outputs
    df = outputs["output"].collect()
    assert len(df) == 3
    assert df["value"][0] == 10.0


@pytest.mark.asyncio
async def test_ndjson_input_with_n_rows(sample_ndjson: Path):
    """Test InputTool with NDJSON limiting rows"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": str(sample_ndjson),
        "jsonMode": "scan",
        "n_rows": 2
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert len(df) == 2


@pytest.mark.asyncio
async def test_ndjson_input_with_row_index(sample_ndjson: Path):
    """Test InputTool with NDJSON adding row index"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": str(sample_ndjson),
        "jsonMode": "scan",
        "row_index_name": "row_num"
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert "row_num" in df.columns
    assert df["row_num"][0] == 0
    assert df["row_num"][4] == 4


# -----------------------------------------------------------------------------
# InputTool Tests - Nested JSON
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_json_input_preserves_nested_structures(nested_json: Path):
    """Test that nested JSON structures are preserved as-is"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": str(nested_json),
        "jsonMode": "read"
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    # Should have nested structure columns
    assert "user" in df.columns
    assert "tags" in df.columns
    # Nested structures are kept as Struct/List types
    assert df["id"][0] == 1


# -----------------------------------------------------------------------------
# OutputTool Tests - NDJSON
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_ndjson_output_tool_sink_mode(tmp_path: Path):
    """Test OutputTool with NDJSON in sink mode (streaming)"""
    tool = OutputTool()
    output_path = tmp_path / "output.ndjson"

    # Create input LazyFrame
    lf = pl.DataFrame({
        "id": [1, 2, 3],
        "name": ["A", "B", "C"]
    }).lazy()

    config = {
        "type": "json",
        "destination": str(output_path),
        "jsonMode": "sink"
    }

    await tool.execute(config, {"input": lf})

    # Verify file was created
    assert output_path.exists()

    # Read back and verify
    df = pl.read_ndjson(output_path)
    assert len(df) == 3
    assert df["name"][0] == "A"


@pytest.mark.asyncio
async def test_ndjson_output_tool_write_mode(tmp_path: Path):
    """Test OutputTool with NDJSON in write mode (eager)"""
    tool = OutputTool()
    output_path = tmp_path / "output.ndjson"

    lf = pl.DataFrame({
        "id": [1, 2, 3],
        "name": ["A", "B", "C"]
    }).lazy()

    config = {
        "type": "json",
        "destination": str(output_path),
        "jsonMode": "write"
    }

    await tool.execute(config, {"input": lf})

    assert output_path.exists()

    df = pl.read_ndjson(output_path)
    assert len(df) == 3


@pytest.mark.asyncio
async def test_json_output_tool_standard_format(tmp_path: Path):
    """Test OutputTool with standard JSON format"""
    tool = OutputTool()
    output_path = tmp_path / "output.json"

    lf = pl.DataFrame({
        "id": [1, 2, 3],
        "name": ["A", "B", "C"]
    }).lazy()

    config = {
        "type": "json",
        "destination": str(output_path),
        "jsonMode": "write"  # Standard JSON only supports write
    }

    await tool.execute(config, {"input": lf})

    assert output_path.exists()

    # Read back - standard JSON
    df = pl.read_json(output_path)
    assert len(df) == 3
    assert df["name"][0] == "A"


@pytest.mark.asyncio
async def test_jsonl_output_treated_as_ndjson(tmp_path: Path):
    """Test that .jsonl output is treated as NDJSON"""
    tool = OutputTool()
    output_path = tmp_path / "output.jsonl"

    lf = pl.DataFrame({
        "id": [1, 2],
        "value": [10.0, 20.0]
    }).lazy()

    config = {
        "type": "json",
        "destination": str(output_path),
        "jsonMode": "sink"
    }

    await tool.execute(config, {"input": lf})

    assert output_path.exists()

    # Should be readable as NDJSON
    df = pl.read_ndjson(output_path)
    assert len(df) == 2


# -----------------------------------------------------------------------------
# Config Validation Tests
# -----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_json_input_validate_config():
    """Test InputTool config validation for JSON"""
    tool = InputTool()

    # Valid JSON config
    errors = await tool.validate_config({
        "type": "json",
        "source": "/path/to/file.json"
    })
    assert len(errors) == 0

    # Invalid - missing source
    errors = await tool.validate_config({
        "type": "json"
    })
    assert len(errors) > 0


@pytest.mark.asyncio
async def test_json_output_validate_config():
    """Test OutputTool config validation for JSON"""
    tool = OutputTool()

    # Valid JSON config
    errors = await tool.validate_config({
        "type": "json",
        "destination": "/path/to/file.ndjson",
        "jsonMode": "sink"
    })
    assert len(errors) == 0

    # Invalid - sink mode with standard JSON
    errors = await tool.validate_config({
        "type": "json",
        "destination": "/path/to/file.json",
        "jsonMode": "sink"
    })
    assert len(errors) > 0
    assert any("sink" in e.lower() for e in errors)

    # Invalid - missing destination
    errors = await tool.validate_config({
        "type": "json"
    })
    assert len(errors) > 0


# -----------------------------------------------------------------------------
# Code Generation Tests
# -----------------------------------------------------------------------------


def test_json_input_code_generation_standard():
    """Test code generation for standard JSON input"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": "/data/input.json",
        "jsonMode": "read"
    }

    lines, output_vars = tool.to_python_code("input_1", config, {})

    code = "\n".join(lines)
    assert "read_json" in code
    assert "/data/input.json" in code


def test_ndjson_input_code_generation_scan():
    """Test code generation for NDJSON input with scan mode"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": "/data/input.ndjson",
        "jsonMode": "scan"
    }

    lines, output_vars = tool.to_python_code("input_1", config, {})

    code = "\n".join(lines)
    assert "scan_ndjson" in code
    assert "/data/input.ndjson" in code


def test_ndjson_input_code_generation_read():
    """Test code generation for NDJSON input with read mode"""
    tool = InputTool()

    config = {
        "type": "json",
        "source": "/data/input.ndjson",
        "jsonMode": "read"
    }

    lines, output_vars = tool.to_python_code("input_1", config, {})

    code = "\n".join(lines)
    assert "read_ndjson" in code
    assert "/data/input.ndjson" in code


def test_json_output_code_generation():
    """Test code generation for JSON output"""
    tool = OutputTool()

    config = {
        "type": "json",
        "destination": "/data/output.json",
        "jsonMode": "write"
    }

    lines, output_vars = tool.to_python_code("output_1", config, {"input": "df"})

    code = "\n".join(lines)
    assert "write_json" in code
    assert "/data/output.json" in code


def test_ndjson_output_code_generation_sink():
    """Test code generation for NDJSON output with sink mode"""
    tool = OutputTool()

    config = {
        "type": "json",
        "destination": "/data/output.ndjson",
        "jsonMode": "sink"
    }

    lines, output_vars = tool.to_python_code("output_1", config, {"input": "df"})

    code = "\n".join(lines)
    assert "sink_ndjson" in code
    assert "/data/output.ndjson" in code
