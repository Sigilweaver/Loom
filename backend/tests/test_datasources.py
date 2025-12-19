"""Tests for data source functionality"""


import pytest

from app.domain.datasources.csv import CSVDataSource
from app.domain.datasources.factory import DataSourceFactory
from app.domain.datasources.json import JSONDataSource
from app.utils.errors import DataSourceError


def test_detect_csv_source_type():
    """Test CSV source type detection"""
    assert DataSourceFactory.detect_source_type("/path/to/file.csv") == "csv"
    assert DataSourceFactory.detect_source_type("/path/to/file.tsv") == "csv"
    assert DataSourceFactory.detect_source_type("/path/to/file.CSV") == "csv"


def test_detect_json_source_type():
    """Test JSON source type detection"""
    assert DataSourceFactory.detect_source_type("/path/to/file.json") == "json"
    assert DataSourceFactory.detect_source_type("/path/to/file.jsonl") == "json"
    assert DataSourceFactory.detect_source_type("/path/to/file.ndjson") == "json"
    assert DataSourceFactory.detect_source_type("/path/to/file.JSON") == "json"


def test_detect_unsupported_extension():
    """Test unsupported extension raises error"""
    with pytest.raises(DataSourceError, match="Unsupported file extension"):
        DataSourceFactory.detect_source_type("/path/to/file.xyz")


def test_create_csv_datasource():
    """Test creating CSV data source"""
    datasource = DataSourceFactory.create("csv")
    assert isinstance(datasource, CSVDataSource)


def test_create_json_datasource():
    """Test creating JSON data source"""
    datasource = DataSourceFactory.create("json")
    assert isinstance(datasource, JSONDataSource)


def test_create_unknown_datasource():
    """Test creating unknown data source raises error"""
    with pytest.raises(DataSourceError, match="Unknown data source type"):
        DataSourceFactory.create("unknown")


def test_list_supported():
    """Test listing supported types and extensions"""
    types = DataSourceFactory.list_supported_types()
    assert "csv" in types
    assert "json" in types

    extensions = DataSourceFactory.list_supported_extensions()
    assert ".csv" in extensions
    assert ".tsv" in extensions
    assert ".json" in extensions
    assert ".jsonl" in extensions
    assert ".ndjson" in extensions


@pytest.mark.asyncio
async def test_csv_config_validation():
    """Test CSV configuration validation"""
    datasource = CSVDataSource()

    # Valid config
    errors = await datasource.validate_config({"separator": ",", "skip_rows": 0})
    assert len(errors) == 0

    # Invalid separator
    errors = await datasource.validate_config({"separator": ""})
    assert len(errors) > 0
    assert any("separator" in err for err in errors)

    # Invalid skip_rows
    errors = await datasource.validate_config({"skip_rows": -1})
    assert len(errors) > 0
    assert any("skip_rows" in err for err in errors)


@pytest.mark.asyncio
async def test_json_config_validation():
    """Test JSON configuration validation"""
    datasource = JSONDataSource()

    # Valid config
    errors = await datasource.validate_config({"infer_schema_length": 100})
    assert len(errors) == 0

    # Invalid infer_schema_length
    errors = await datasource.validate_config({"infer_schema_length": -1})
    assert len(errors) > 0
    assert any("infer_schema_length" in err for err in errors)

    # Invalid n_rows
    errors = await datasource.validate_config({"n_rows": 0})
    assert len(errors) > 0
    assert any("n_rows" in err for err in errors)

    # Invalid batch_size
    errors = await datasource.validate_config({"batch_size": 0})
    assert len(errors) > 0
    assert any("batch_size" in err for err in errors)


@pytest.mark.asyncio
async def test_json_inspect_standard_json():
    """Test inspecting standard JSON file"""
    import os

    datasource = JSONDataSource()
    fixture_path = os.path.join(
        os.path.dirname(__file__), "fixtures", "sample.json"
    )
    result = await datasource.inspect(fixture_path, {})

    # Note: row_count is not available without full scan for standard JSON
    assert len(result.columns) == 4
    assert result.file_size_bytes > 0

    # Check column names
    col_names = [col.name for col in result.columns]
    assert "id" in col_names
    assert "name" in col_names
    assert "age" in col_names
    assert "city" in col_names


@pytest.mark.asyncio
async def test_json_inspect_ndjson():
    """Test inspecting NDJSON file"""
    import os

    datasource = JSONDataSource()
    fixture_path = os.path.join(
        os.path.dirname(__file__), "fixtures", "sample.ndjson"
    )
    result = await datasource.inspect(fixture_path, {})

    # Note: row_count is not available without full scan for NDJSON with lazy scan
    assert len(result.columns) == 4
    assert result.file_size_bytes > 0

    # Check column names
    col_names = [col.name for col in result.columns]
    assert "id" in col_names
    assert "name" in col_names
    assert "age" in col_names
    assert "city" in col_names


@pytest.mark.asyncio
async def test_json_preview_standard_json():
    """Test previewing standard JSON file"""
    import os

    datasource = JSONDataSource()
    fixture_path = os.path.join(
        os.path.dirname(__file__), "fixtures", "sample.json"
    )
    result = await datasource.preview(fixture_path, {}, max_rows=3)

    assert result.returned_rows == 3
    assert len(result.data_schema.columns) == 4
    assert len(result.data) == 3
    # Check first row has expected fields
    assert result.data[0]["id"] == 1
    assert result.data[0]["name"] == "Alice"


@pytest.mark.asyncio
async def test_json_preview_ndjson():
    """Test previewing NDJSON file"""
    import os

    datasource = JSONDataSource()
    fixture_path = os.path.join(
        os.path.dirname(__file__), "fixtures", "sample.ndjson"
    )
    result = await datasource.preview(fixture_path, {}, max_rows=3)

    assert result.returned_rows == 3
    assert len(result.data_schema.columns) == 4
    assert len(result.data) == 3
    # Check first row has expected fields
    assert result.data[0]["id"] == 1
    assert result.data[0]["name"] == "Alice"
