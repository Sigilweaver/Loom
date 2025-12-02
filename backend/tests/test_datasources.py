"""Tests for data source functionality"""


import pytest

from app.domain.datasources.csv import CSVDataSource
from app.domain.datasources.factory import DataSourceFactory
from app.utils.errors import DataSourceError


def test_detect_csv_source_type():
    """Test CSV source type detection"""
    assert DataSourceFactory.detect_source_type("/path/to/file.csv") == "csv"
    assert DataSourceFactory.detect_source_type("/path/to/file.tsv") == "csv"
    assert DataSourceFactory.detect_source_type("/path/to/file.CSV") == "csv"


def test_detect_unsupported_extension():
    """Test unsupported extension raises error"""
    with pytest.raises(DataSourceError, match="Unsupported file extension"):
        DataSourceFactory.detect_source_type("/path/to/file.xyz")


def test_create_csv_datasource():
    """Test creating CSV data source"""
    datasource = DataSourceFactory.create("csv")
    assert isinstance(datasource, CSVDataSource)


def test_create_unknown_datasource():
    """Test creating unknown data source raises error"""
    with pytest.raises(DataSourceError, match="Unknown data source type"):
        DataSourceFactory.create("unknown")


def test_list_supported():
    """Test listing supported types and extensions"""
    types = DataSourceFactory.list_supported_types()
    assert "csv" in types

    extensions = DataSourceFactory.list_supported_extensions()
    assert ".csv" in extensions
    assert ".tsv" in extensions


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
