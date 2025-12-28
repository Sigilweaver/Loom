"""Tests for Parquet input/output functionality"""

from pathlib import Path

import polars as pl
import pytest

from app.domain.datasources.parquet import ParquetDataSource
from app.domain.tools.implementations.input import InputTool
from app.domain.tools.implementations.output import OutputTool


@pytest.fixture
def sample_parquet(tmp_path: Path) -> Path:
    """Create a sample Parquet file for testing"""
    parquet_path = tmp_path / "test_data.parquet"

    # Create sample data
    df = pl.DataFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "age": [25, 30, 35, 40, 45],
        "score": [85.5, 92.0, 78.3, 88.7, 95.2],
        "active": [True, True, False, True, False]
    })

    # Write to Parquet
    df.write_parquet(parquet_path)

    return parquet_path


@pytest.mark.asyncio
async def test_parquet_datasource_inspect(sample_parquet: Path):
    """Test ParquetDataSource.inspect() returns correct schema"""
    datasource = ParquetDataSource()

    schema = await datasource.inspect(str(sample_parquet), {})

    assert len(schema.columns) == 5
    assert schema.columns[0].name == "id"
    assert schema.columns[1].name == "name"
    assert schema.columns[2].name == "age"
    assert schema.columns[3].name == "score"
    assert schema.columns[4].name == "active"
    assert schema.file_size_bytes > 0


@pytest.mark.asyncio
async def test_parquet_datasource_preview(sample_parquet: Path):
    """Test ParquetDataSource.preview() returns correct data"""
    datasource = ParquetDataSource()

    preview = await datasource.preview(str(sample_parquet), {}, max_rows=3)

    assert preview.returned_rows == 3
    assert len(preview.data) == 3
    assert preview.data[0]["name"] == "Alice"
    assert preview.data[1]["age"] == 30
    assert preview.data[2]["score"] == 78.3


@pytest.mark.asyncio
async def test_parquet_input_tool_scan_mode(sample_parquet: Path):
    """Test InputTool with Parquet in scan mode (lazy)"""
    tool = InputTool()

    config = {
        "type": "parquet",
        "source": str(sample_parquet),
        "parquetMode": "scan"
    }

    outputs = await tool.execute(config, {})

    assert "output" in outputs
    lf = outputs["output"]
    assert isinstance(lf, pl.LazyFrame)

    # Collect to verify data
    df = lf.collect()
    assert len(df) == 5
    assert df["name"][0] == "Alice"


@pytest.mark.asyncio
async def test_parquet_input_tool_read_mode(sample_parquet: Path):
    """Test InputTool with Parquet in read mode (eager -> lazy)"""
    tool = InputTool()

    config = {
        "type": "parquet",
        "source": str(sample_parquet),
        "parquetMode": "read"
    }

    outputs = await tool.execute(config, {})

    assert "output" in outputs
    lf = outputs["output"]
    assert isinstance(lf, pl.LazyFrame)

    df = lf.collect()
    assert len(df) == 5


@pytest.mark.asyncio
async def test_parquet_input_with_column_selection(sample_parquet: Path):
    """Test InputTool with Parquet selecting specific columns"""
    tool = InputTool()

    config = {
        "type": "parquet",
        "source": str(sample_parquet),
        "parquetMode": "scan",
        "columns": ["name", "age"]
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert df.columns == ["name", "age"]
    assert len(df) == 5


@pytest.mark.asyncio
async def test_parquet_input_with_n_rows(sample_parquet: Path):
    """Test InputTool with Parquet limiting rows"""
    tool = InputTool()

    config = {
        "type": "parquet",
        "source": str(sample_parquet),
        "parquetMode": "scan",
        "n_rows": 2
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert len(df) == 2
    assert df["name"][0] == "Alice"
    assert df["name"][1] == "Bob"


@pytest.mark.asyncio
async def test_parquet_output_tool_sink_mode(tmp_path: Path, sample_parquet: Path):
    """Test OutputTool with Parquet in sink mode (streaming)"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Read from sample
    input_config = {
        "type": "parquet",
        "source": str(sample_parquet),
        "parquetMode": "scan"
    }

    lf = (await input_tool.execute(input_config, {}))["output"]

    # Write to output
    output_path = tmp_path / "output.parquet"
    output_config = {
        "type": "parquet",
        "destination": str(output_path),
        "parquetMode": "sink"
    }

    await output_tool.execute(output_config, {"input": lf})

    # Verify output file was created
    assert output_path.exists()

    # Verify contents
    result_df = pl.read_parquet(output_path)
    assert len(result_df) == 5
    assert result_df["name"][0] == "Alice"


@pytest.mark.asyncio
async def test_parquet_output_tool_write_mode(tmp_path: Path, sample_parquet: Path):
    """Test OutputTool with Parquet in write mode (eager)"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Read from sample
    input_config = {
        "type": "parquet",
        "source": str(sample_parquet),
        "parquetMode": "scan"
    }

    lf = (await input_tool.execute(input_config, {}))["output"]

    # Write to output
    output_path = tmp_path / "output_write.parquet"
    output_config = {
        "type": "parquet",
        "destination": str(output_path),
        "parquetMode": "write"
    }

    await output_tool.execute(output_config, {"input": lf})

    # Verify output file was created
    assert output_path.exists()

    # Verify contents
    result_df = pl.read_parquet(output_path)
    assert len(result_df) == 5


@pytest.mark.asyncio
async def test_parquet_roundtrip_with_filter(tmp_path: Path, sample_parquet: Path):
    """Test reading Parquet, filtering, and writing back"""
    from app.domain.tools.implementations.filter import FilterTool

    input_tool = InputTool()
    filter_tool = FilterTool()
    output_tool = OutputTool()

    # Read
    input_config = {
        "type": "parquet",
        "source": str(sample_parquet),
        "parquetMode": "scan"
    }
    lf = (await input_tool.execute(input_config, {}))["output"]

    # Filter (age > 30)
    filter_config = {"expression": "pl.col('age') > 30"}
    filtered_outputs = await filter_tool.execute(filter_config, {"input": lf})
    filtered_lf = filtered_outputs["output-true"]  # True branch

    # Write
    output_path = tmp_path / "filtered.parquet"
    output_config = {
        "type": "parquet",
        "destination": str(output_path),
        "parquetMode": "sink"
    }
    await output_tool.execute(output_config, {"input": filtered_lf})

    # Verify
    result_df = pl.read_parquet(output_path)
    assert len(result_df) == 3  # Charlie, David, Eve (ages 35, 40, 45)
    assert all(result_df["age"] > 30)


@pytest.mark.asyncio
async def test_parquet_input_get_output_schema(sample_parquet: Path):
    """Test InputTool.get_output_schema() for Parquet"""
    tool = InputTool()

    config = {
        "type": "parquet",
        "source": str(sample_parquet),
        "parquetMode": "scan"
    }

    schemas = await tool.get_output_schema(config, {})

    assert "output" in schemas
    schema = schemas["output"]
    assert len(schema.columns) == 5
    assert schema.columns[0].name == "id"
    assert schema.columns[1].name == "name"


@pytest.mark.asyncio
async def test_parquet_validate_config():
    """Test validate_config for Parquet input/output"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Valid input config
    input_errors = await input_tool.validate_config({
        "type": "parquet",
        "source": "/path/to/file.parquet"
    })
    assert len(input_errors) == 0

    # Invalid input config (missing source)
    input_errors = await input_tool.validate_config({
        "type": "parquet"
    })
    assert len(input_errors) > 0

    # Valid output config
    output_errors = await output_tool.validate_config({
        "type": "parquet",
        "destination": "/path/to/output.parquet",
        "parquetMode": "sink"
    })
    assert len(output_errors) == 0

    # Invalid output config (bad mode)
    output_errors = await output_tool.validate_config({
        "type": "parquet",
        "destination": "/path/to/output.parquet",
        "parquetMode": "invalid"
    })
    assert len(output_errors) > 0
