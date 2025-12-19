"""Tests for ODS input functionality"""

from pathlib import Path

import polars as pl
import pytest

from app.domain.datasources.ods import ODSDataSource
from app.domain.tools.implementations.input import InputTool

# Path to sample ODS file (Polars cannot write ODS, so we use a pre-made file)
SAMPLE_ODS = Path(__file__).parent / "fixtures" / "sample.ods"


@pytest.fixture
def sample_ods() -> Path:
    """Return path to sample ODS file"""
    return SAMPLE_ODS


# ========================================
# ODSDataSource Tests
# ========================================

@pytest.mark.asyncio
async def test_ods_datasource_inspect(sample_ods: Path):
    """Test ODSDataSource.inspect() returns correct schema"""
    datasource = ODSDataSource()

    schema = await datasource.inspect(str(sample_ods), {})

    assert len(schema.columns) == 4
    assert schema.columns[0].name == "id"
    assert schema.columns[1].name == "name"
    assert schema.columns[2].name == "age"
    assert schema.columns[3].name == "city"
    assert schema.file_size_bytes > 0


@pytest.mark.asyncio
async def test_ods_datasource_preview(sample_ods: Path):
    """Test ODSDataSource.preview() returns correct data"""
    datasource = ODSDataSource()

    preview = await datasource.preview(str(sample_ods), {}, max_rows=3)

    assert preview.returned_rows == 3
    assert len(preview.data) == 3
    assert preview.data[0]["name"] == "Alice"
    assert preview.data[1]["age"] == 25
    assert preview.data[2]["city"] == "Chicago"


@pytest.mark.asyncio
async def test_ods_datasource_preview_with_offset(sample_ods: Path):
    """Test ODSDataSource.preview() with offset"""
    datasource = ODSDataSource()

    preview = await datasource.preview(str(sample_ods), {}, max_rows=2, offset=2)

    assert preview.returned_rows == 2
    assert len(preview.data) == 2
    assert preview.data[0]["name"] == "Charlie"
    assert preview.data[1]["name"] == "Diana"


@pytest.mark.asyncio
async def test_ods_datasource_preview_with_columns(sample_ods: Path):
    """Test ODSDataSource.preview() with column selection"""
    datasource = ODSDataSource()

    preview = await datasource.preview(
        str(sample_ods), {}, max_rows=100, columns=["name", "city"]
    )

    assert preview.returned_rows == 5
    assert len(preview.data_schema.columns) == 2
    assert preview.data_schema.columns[0].name == "name"
    assert preview.data_schema.columns[1].name == "city"


@pytest.mark.asyncio
async def test_ods_datasource_validate_config():
    """Test ODSDataSource.validate_config()"""
    datasource = ODSDataSource()

    # Valid config
    errors = await datasource.validate_config({})
    assert errors == []

    # Valid sheet_id
    errors = await datasource.validate_config({"sheet_id": 1})
    assert errors == []

    # Valid sheet_name
    errors = await datasource.validate_config({"sheet_name": "Sheet1"})
    assert errors == []

    # Both sheet_id and sheet_name (invalid)
    errors = await datasource.validate_config({"sheet_id": 1, "sheet_name": "Sheet1"})
    assert len(errors) == 1
    assert "both sheet_id and sheet_name" in errors[0].lower()

    # Invalid sheet_id (negative)
    errors = await datasource.validate_config({"sheet_id": -1})
    assert len(errors) == 1
    assert "sheet_id" in errors[0].lower()

    # Invalid infer_schema_length
    errors = await datasource.validate_config({"infer_schema_length": -5})
    assert len(errors) == 1
    assert "infer_schema_length" in errors[0].lower()


# ========================================
# InputTool with ODS Tests
# ========================================

@pytest.mark.asyncio
async def test_ods_input_tool_basic(sample_ods: Path):
    """Test InputTool with ODS basic read"""
    tool = InputTool()

    config = {
        "type": "ods",
        "source": str(sample_ods),
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
async def test_ods_input_with_sheet_id(sample_ods: Path):
    """Test InputTool with ODS specifying sheet by ID"""
    tool = InputTool()

    config = {
        "type": "ods",
        "source": str(sample_ods),
        "sheet_id": 1  # First sheet (1-indexed)
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert len(df) == 5
    assert df["name"][0] == "Alice"


@pytest.mark.asyncio
async def test_ods_input_with_columns(sample_ods: Path):
    """Test InputTool with ODS column selection by name"""
    tool = InputTool()

    config = {
        "type": "ods",
        "source": str(sample_ods),
        "columns": ["name", "city"]
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert df.columns == ["name", "city"]
    assert len(df) == 5


@pytest.mark.asyncio
async def test_ods_input_without_header(sample_ods: Path):
    """Test InputTool with ODS when has_header=False"""
    tool = InputTool()

    config = {
        "type": "ods",
        "source": str(sample_ods),
        "has_header": False
    }

    outputs = await tool.execute(config, {})
    result = outputs["output"].collect()

    # When has_header=False, first data row is treated as data, not headers
    # So we get 6 rows (header row + 5 data rows) with generated column names
    assert len(result) == 6


@pytest.mark.asyncio
async def test_ods_input_with_infer_schema_length(sample_ods: Path):
    """Test InputTool with ODS using infer_schema_length"""
    tool = InputTool()

    config = {
        "type": "ods",
        "source": str(sample_ods),
        "infer_schema_length": 2
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    # Should still read all rows, just use 2 rows for schema inference
    assert len(df) == 5


@pytest.mark.asyncio
async def test_ods_input_drop_empty_rows(sample_ods: Path):
    """Test InputTool with ODS drop_empty_rows option"""
    tool = InputTool()

    config = {
        "type": "ods",
        "source": str(sample_ods),
        "drop_empty_rows": True
    }

    outputs = await tool.execute(config, {})
    result = outputs["output"].collect()

    # Sample file has no empty rows, so all 5 should remain
    assert len(result) == 5


# ========================================
# Validation Tests
# ========================================

@pytest.mark.asyncio
async def test_ods_input_validate_config():
    """Test InputTool.validate_config for ODS"""
    tool = InputTool()

    # Valid config
    errors = await tool.validate_config({
        "type": "ods",
        "source": "/path/to/file.ods"
    })
    assert errors == []

    # Missing source
    errors = await tool.validate_config({
        "type": "ods"
    })
    assert any("source" in e.lower() for e in errors)
