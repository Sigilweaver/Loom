"""Tests for Avro input/output functionality"""

from pathlib import Path

import polars as pl
import pytest

from app.domain.datasources.avro import AvroDataSource
from app.domain.tools.implementations.input import InputTool
from app.domain.tools.implementations.output import OutputTool


@pytest.fixture
def sample_avro(tmp_path: Path) -> Path:
    """Create a sample Avro file for testing"""
    avro_path = tmp_path / "test_data.avro"

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

    # Write to Avro
    df.write_avro(avro_path)

    return avro_path


# ========================================
# AvroDataSource Tests
# ========================================


@pytest.mark.asyncio
async def test_avro_datasource_inspect(sample_avro: Path):
    """Test AvroDataSource.inspect() returns correct schema"""
    datasource = AvroDataSource()

    schema = await datasource.inspect(str(sample_avro), {})

    assert len(schema.columns) == 5
    assert schema.columns[0].name == "id"
    assert schema.columns[1].name == "name"
    assert schema.columns[2].name == "age"
    assert schema.columns[3].name == "score"
    assert schema.columns[4].name == "active"
    assert schema.file_size_bytes > 0


@pytest.mark.asyncio
async def test_avro_datasource_preview(sample_avro: Path):
    """Test AvroDataSource.preview() returns correct data"""
    datasource = AvroDataSource()

    preview = await datasource.preview(str(sample_avro), {}, max_rows=3)

    assert preview.returned_rows == 3
    assert len(preview.data) == 3
    assert preview.data[0]["name"] == "Alice"
    assert preview.data[1]["age"] == 30
    assert preview.data[2]["score"] == 78.3


@pytest.mark.asyncio
async def test_avro_datasource_preview_with_offset(sample_avro: Path):
    """Test AvroDataSource.preview() with offset"""
    datasource = AvroDataSource()

    preview = await datasource.preview(str(sample_avro), {}, max_rows=2, offset=2)

    assert preview.returned_rows == 2
    assert len(preview.data) == 2
    assert preview.data[0]["name"] == "Charlie"
    assert preview.data[1]["name"] == "David"


@pytest.mark.asyncio
async def test_avro_datasource_preview_with_columns(sample_avro: Path):
    """Test AvroDataSource.preview() with column selection"""
    datasource = AvroDataSource()

    preview = await datasource.preview(str(sample_avro), {}, max_rows=100, columns=["name", "age"])

    assert preview.returned_rows == 5
    assert len(preview.data_schema.columns) == 2
    assert preview.data_schema.columns[0].name == "name"
    assert preview.data_schema.columns[1].name == "age"


@pytest.mark.asyncio
async def test_avro_datasource_validate_config():
    """Test AvroDataSource.validate_config()"""
    datasource = AvroDataSource()

    # Valid config
    errors = await datasource.validate_config({})
    assert errors == []

    # Invalid n_rows
    errors = await datasource.validate_config({"n_rows": -5})
    assert len(errors) == 1
    assert "n_rows" in errors[0].lower()

    # Invalid columns type
    errors = await datasource.validate_config({"columns": "not_a_list"})
    assert len(errors) == 1
    assert "columns" in errors[0].lower()


# ========================================
# InputTool with Avro Tests
# ========================================


@pytest.mark.asyncio
async def test_avro_input_tool_basic(sample_avro: Path):
    """Test InputTool with Avro basic read"""
    tool = InputTool()

    config = {
        "type": "avro",
        "source": str(sample_avro),
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
async def test_avro_input_with_n_rows(sample_avro: Path):
    """Test InputTool with Avro limiting rows"""
    tool = InputTool()

    config = {"type": "avro", "source": str(sample_avro), "n_rows": 2}

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert len(df) == 2
    assert df["name"][0] == "Alice"
    assert df["name"][1] == "Bob"


@pytest.mark.asyncio
async def test_avro_input_with_columns(sample_avro: Path):
    """Test InputTool with Avro column selection by name"""
    tool = InputTool()

    config = {"type": "avro", "source": str(sample_avro), "columns": ["name", "age"]}

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert df.columns == ["name", "age"]
    assert len(df) == 5


# ========================================
# OutputTool with Avro Tests
# ========================================


@pytest.mark.asyncio
async def test_avro_output_tool_basic(tmp_path: Path, sample_avro: Path):
    """Test OutputTool with Avro basic write"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Load test data
    input_config = {
        "type": "avro",
        "source": str(sample_avro),
    }
    inputs = await input_tool.execute(input_config, {})

    # Write to new file
    output_path = tmp_path / "output.avro"
    output_config = {
        "type": "avro",
        "destination": str(output_path),
    }
    await output_tool.execute(output_config, {"input": inputs["output"]})

    # Verify output file exists and has correct data
    assert output_path.exists()
    result = pl.read_avro(output_path)
    assert len(result) == 5
    assert result["name"][0] == "Alice"


@pytest.mark.asyncio
async def test_avro_output_with_snappy_compression(tmp_path: Path, sample_avro: Path):
    """Test OutputTool with Avro using snappy compression"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Load test data
    input_config = {
        "type": "avro",
        "source": str(sample_avro),
    }
    inputs = await input_tool.execute(input_config, {})

    # Write with snappy compression
    output_path = tmp_path / "output_snappy.avro"
    output_config = {"type": "avro", "destination": str(output_path), "compression": "snappy"}
    await output_tool.execute(output_config, {"input": inputs["output"]})

    # Verify output
    assert output_path.exists()
    result = pl.read_avro(output_path)
    assert len(result) == 5


@pytest.mark.asyncio
async def test_avro_output_with_deflate_compression(tmp_path: Path, sample_avro: Path):
    """Test OutputTool with Avro using deflate compression"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Load test data
    input_config = {
        "type": "avro",
        "source": str(sample_avro),
    }
    inputs = await input_tool.execute(input_config, {})

    # Write with deflate compression
    output_path = tmp_path / "output_deflate.avro"
    output_config = {"type": "avro", "destination": str(output_path), "compression": "deflate"}
    await output_tool.execute(output_config, {"input": inputs["output"]})

    # Verify output
    assert output_path.exists()
    result = pl.read_avro(output_path)
    assert len(result) == 5


@pytest.mark.asyncio
async def test_avro_output_with_schema_name(tmp_path: Path, sample_avro: Path):
    """Test OutputTool with Avro specifying schema name"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Load test data
    input_config = {
        "type": "avro",
        "source": str(sample_avro),
    }
    inputs = await input_tool.execute(input_config, {})

    # Write with schema name
    output_path = tmp_path / "output_named.avro"
    output_config = {"type": "avro", "destination": str(output_path), "name": "TestDataSchema"}
    await output_tool.execute(output_config, {"input": inputs["output"]})

    # Verify output
    assert output_path.exists()
    result = pl.read_avro(output_path)
    assert len(result) == 5


@pytest.mark.asyncio
async def test_avro_roundtrip(tmp_path: Path):
    """Test Avro roundtrip: write then read"""
    input_tool = InputTool()
    output_tool = OutputTool()

    # Create test data
    original_df = pl.DataFrame(
        {
            "integers": [1, 2, 3, 4, 5],
            "floats": [1.1, 2.2, 3.3, 4.4, 5.5],
            "strings": ["a", "b", "c", "d", "e"],
            "booleans": [True, False, True, False, True],
        }
    )

    # Write to Avro
    avro_path = tmp_path / "roundtrip.avro"
    original_df.write_avro(avro_path)

    # Read back using InputTool
    input_config = {
        "type": "avro",
        "source": str(avro_path),
    }
    outputs = await input_tool.execute(input_config, {})
    lf = outputs["output"]

    # Write again using OutputTool
    output_path = tmp_path / "roundtrip_output.avro"
    output_config = {
        "type": "avro",
        "destination": str(output_path),
    }
    await output_tool.execute(output_config, {"input": lf})

    # Verify final output matches original
    result = pl.read_avro(output_path)
    assert result.columns == original_df.columns
    assert len(result) == len(original_df)
    assert result["integers"].to_list() == original_df["integers"].to_list()
    assert result["strings"].to_list() == original_df["strings"].to_list()


# ========================================
# Validation Tests
# ========================================


@pytest.mark.asyncio
async def test_avro_input_validate_config():
    """Test InputTool.validate_config for Avro"""
    tool = InputTool()

    # Valid config
    errors = await tool.validate_config({"type": "avro", "source": "/path/to/file.avro"})
    assert errors == []

    # Missing source
    errors = await tool.validate_config({"type": "avro"})
    assert any("source" in e.lower() for e in errors)


@pytest.mark.asyncio
async def test_avro_output_validate_config():
    """Test OutputTool.validate_config for Avro"""
    tool = OutputTool()

    # Valid config
    errors = await tool.validate_config({"type": "avro", "destination": "/path/to/output.avro"})
    assert errors == []

    # Missing destination
    errors = await tool.validate_config({"type": "avro"})
    assert any("destination" in e.lower() for e in errors)
