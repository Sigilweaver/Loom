"""Tests for Excel input functionality"""

from pathlib import Path

import polars as pl
import pytest

from app.domain.datasources.excel import ExcelDataSource
from app.domain.datasources.factory import DataSourceFactory
from app.domain.tools.implementations.input import InputTool
from app.utils.errors import DataSourceError


@pytest.fixture
def sample_excel(tmp_path: Path) -> Path:
    """Create a sample Excel file for testing"""
    excel_path = tmp_path / "test_data.xlsx"

    # Create sample data
    df = pl.DataFrame({
        "id": [1, 2, 3, 4, 5],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "age": [25, 30, 35, 40, 45],
        "score": [85.5, 92.0, 78.3, 88.7, 95.2],
        "active": [True, True, False, True, False]
    })

    # Write to Excel
    df.write_excel(excel_path)

    return excel_path


@pytest.fixture
def multi_sheet_excel(tmp_path: Path) -> Path:
    """Create an Excel file with multiple sheets for testing"""
    excel_path = tmp_path / "multi_sheet.xlsx"

    # Create sample data for different sheets
    df1 = pl.DataFrame({
        "id": [1, 2, 3],
        "value": ["a", "b", "c"]
    })
    df2 = pl.DataFrame({
        "x": [10, 20, 30],
        "y": [100, 200, 300]
    })

    # Write to Excel with multiple sheets using xlsxwriter
    import xlsxwriter

    workbook = xlsxwriter.Workbook(str(excel_path))

    # Sheet1
    worksheet1 = workbook.add_worksheet("Sheet1")
    worksheet1.write(0, 0, "id")
    worksheet1.write(0, 1, "value")
    for i, (id_val, val) in enumerate(zip(df1["id"], df1["value"]), start=1):
        worksheet1.write(i, 0, id_val)
        worksheet1.write(i, 1, val)

    # Sheet2
    worksheet2 = workbook.add_worksheet("DataSheet")
    worksheet2.write(0, 0, "x")
    worksheet2.write(0, 1, "y")
    for i, (x_val, y_val) in enumerate(zip(df2["x"], df2["y"]), start=1):
        worksheet2.write(i, 0, x_val)
        worksheet2.write(i, 1, y_val)

    workbook.close()

    return excel_path


# Factory tests
def test_detect_excel_source_type():
    """Test Excel source type detection"""
    assert DataSourceFactory.detect_source_type("/path/to/file.xlsx") == "excel"
    assert DataSourceFactory.detect_source_type("/path/to/file.xls") == "excel"
    assert DataSourceFactory.detect_source_type("/path/to/file.xlsb") == "excel"
    assert DataSourceFactory.detect_source_type("/path/to/file.XLSX") == "excel"


def test_create_excel_datasource():
    """Test creating Excel data source"""
    datasource = DataSourceFactory.create("excel")
    assert isinstance(datasource, ExcelDataSource)


# Datasource tests
@pytest.mark.asyncio
async def test_excel_datasource_inspect(sample_excel: Path):
    """Test ExcelDataSource.inspect() returns correct schema"""
    datasource = ExcelDataSource()

    schema = await datasource.inspect(str(sample_excel), {})

    assert len(schema.columns) == 5
    assert schema.columns[0].name == "id"
    assert schema.columns[1].name == "name"
    assert schema.columns[2].name == "age"
    assert schema.columns[3].name == "score"
    assert schema.columns[4].name == "active"
    assert schema.file_size_bytes > 0


@pytest.mark.asyncio
async def test_excel_datasource_preview(sample_excel: Path):
    """Test ExcelDataSource.preview() returns correct data"""
    datasource = ExcelDataSource()

    preview = await datasource.preview(str(sample_excel), {}, max_rows=3)

    assert preview.returned_rows == 3
    assert len(preview.data) == 3
    assert preview.data[0]["name"] == "Alice"
    assert preview.data[1]["age"] == 30
    assert preview.data[2]["score"] == 78.3


@pytest.mark.asyncio
async def test_excel_datasource_preview_with_offset(sample_excel: Path):
    """Test ExcelDataSource.preview() with offset"""
    datasource = ExcelDataSource()

    preview = await datasource.preview(str(sample_excel), {}, max_rows=2, offset=2)

    assert preview.returned_rows == 2
    assert preview.data[0]["name"] == "Charlie"
    assert preview.data[1]["name"] == "David"


@pytest.mark.asyncio
async def test_excel_datasource_validate_config():
    """Test ExcelDataSource.validate_config()"""
    datasource = ExcelDataSource()

    # Valid config
    errors = await datasource.validate_config({"sheet_id": 1})
    assert len(errors) == 0

    # Valid config with sheet_name
    errors = await datasource.validate_config({"sheet_name": "Sheet1"})
    assert len(errors) == 0

    # Invalid: negative sheet_id
    errors = await datasource.validate_config({"sheet_id": -1})
    assert len(errors) > 0
    assert any("sheet_id" in err for err in errors)

    # Invalid: both sheet_id and sheet_name
    errors = await datasource.validate_config({"sheet_id": 1, "sheet_name": "Sheet1"})
    assert len(errors) > 0
    assert any("Cannot specify both" in err for err in errors)

    # Invalid: bad infer_schema_length
    errors = await datasource.validate_config({"infer_schema_length": -1})
    assert len(errors) > 0
    assert any("infer_schema_length" in err for err in errors)


# InputTool tests
@pytest.mark.asyncio
async def test_excel_input_tool(sample_excel: Path):
    """Test InputTool with Excel file"""
    tool = InputTool()

    config = {
        "type": "excel",
        "source": str(sample_excel)
    }

    outputs = await tool.execute(config, {})

    assert "output" in outputs
    lf = outputs["output"]
    assert isinstance(lf, pl.LazyFrame)

    # Collect to verify data
    df = lf.collect()
    assert len(df) == 5
    assert df["name"][0] == "Alice"
    assert df["age"][4] == 45


@pytest.mark.asyncio
async def test_excel_input_tool_with_sheet_id(multi_sheet_excel: Path):
    """Test InputTool with Excel file using sheet_id"""
    tool = InputTool()

    # Read first sheet
    config = {
        "type": "excel",
        "source": str(multi_sheet_excel),
        "sheet_id": 1
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert "id" in df.columns
    assert "value" in df.columns
    assert len(df) == 3


@pytest.mark.asyncio
async def test_excel_input_tool_with_sheet_name(multi_sheet_excel: Path):
    """Test InputTool with Excel file using sheet_name"""
    tool = InputTool()

    # Read second sheet by name
    config = {
        "type": "excel",
        "source": str(multi_sheet_excel),
        "sheet_name": "DataSheet"
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    assert "x" in df.columns
    assert "y" in df.columns
    assert len(df) == 3
    assert df["x"][0] == 10
    assert df["y"][2] == 300


@pytest.mark.asyncio
async def test_excel_input_tool_no_header(sample_excel: Path):
    """Test InputTool with Excel file without header"""
    tool = InputTool()

    config = {
        "type": "excel",
        "source": str(sample_excel),
        "has_header": False
    }

    outputs = await tool.execute(config, {})
    df = outputs["output"].collect()

    # Without header, first row becomes data and columns are auto-named
    assert len(df) == 6  # 5 data rows + 1 header row now as data
    # Column names should be auto-generated (column_1, column_2, etc.)
    assert "column_1" in df.columns or df.columns[0].startswith("column")


@pytest.mark.asyncio
async def test_excel_input_tool_missing_source():
    """Test InputTool with Excel file missing source"""
    tool = InputTool()

    config = {
        "type": "excel"
    }

    with pytest.raises(Exception) as exc_info:
        await tool.execute(config, {})

    assert "source" in str(exc_info.value).lower()


@pytest.mark.asyncio
async def test_excel_input_tool_validate_config():
    """Test InputTool.validate_config() for Excel"""
    tool = InputTool()

    # Valid Excel config
    errors = await tool.validate_config({
        "type": "excel",
        "source": "/path/to/file.xlsx"
    })
    assert len(errors) == 0

    # Invalid type
    errors = await tool.validate_config({
        "type": "unsupported_type",
        "source": "/path/to/file.xyz"
    })
    assert len(errors) > 0


# Code generation tests
def test_excel_to_python_code(sample_excel: Path):
    """Test InputTool.to_python_code() for Excel"""
    tool = InputTool()

    config = {
        "type": "excel",
        "source": str(sample_excel),
        "sheet_id": 1,
        "has_header": True
    }

    lines, output_vars = tool.to_python_code("input_1", config, {})

    assert len(lines) >= 1
    assert "read_excel" in lines[0]
    assert str(sample_excel) in lines[0] or "test_data.xlsx" in lines[0]
    assert "engine=\"calamine\"" in lines[0]
    assert "lazy()" in lines[1]  # Should convert to lazy
    assert output_vars["output"].startswith("df_")


def test_excel_to_python_code_with_sheet_name():
    """Test InputTool.to_python_code() with sheet_name"""
    tool = InputTool()

    config = {
        "type": "excel",
        "source": "/path/to/file.xlsx",
        "sheet_name": "MySheet"
    }

    lines, output_vars = tool.to_python_code("input_2", config, {})

    assert "read_excel" in lines[0]
    assert "sheet_name=\"MySheet\"" in lines[0]
