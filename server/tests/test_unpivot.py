"""Tests for the Unpivot tool."""

import polars as pl
import pytest

from app.domain.models.common import ColumnSchema, DataSchema, PolarsDataType
from app.domain.tools.implementations.unpivot import UnpivotTool
from app.domain.tools.sockets import CommonSockets


@pytest.fixture
def unpivot_tool() -> UnpivotTool:
    """Create an UnpivotTool instance."""
    return UnpivotTool()


@pytest.fixture
def wide_data() -> pl.LazyFrame:
    """Create sample wide format data for testing."""
    return pl.LazyFrame(
        {
            "id": [1, 2, 3],
            "name": ["Alice", "Bob", "Carol"],
            "sales_q1": [100, 200, 150],
            "sales_q2": [110, 180, 160],
            "sales_q3": [120, 220, 170],
        }
    )


@pytest.fixture
def wide_schema() -> DataSchema:
    """Create input schema for wide format data."""
    return DataSchema(
        columns=[
            ColumnSchema(name="id", dtype=PolarsDataType.INT64, nullable=True),
            ColumnSchema(name="name", dtype=PolarsDataType.STRING, nullable=True),
            ColumnSchema(name="sales_q1", dtype=PolarsDataType.INT64, nullable=True),
            ColumnSchema(name="sales_q2", dtype=PolarsDataType.INT64, nullable=True),
            ColumnSchema(name="sales_q3", dtype=PolarsDataType.INT64, nullable=True),
        ]
    )


class TestUnpivotToolBlocking:
    """Tests for Unpivot tool blocking behavior."""

    def test_is_not_blocking(self, unpivot_tool: UnpivotTool):
        """Unpivot is not blocking - it's a lazy reshape."""
        assert unpivot_tool.is_blocking({}) is False
        assert unpivot_tool.is_blocking(None) is False

    def test_should_not_cache(self, unpivot_tool: UnpivotTool):
        """Unpivot should not cache since it's not blocking."""
        assert unpivot_tool.should_cache({}) is False


class TestUnpivotToolBasic:
    """Basic unpivot functionality tests."""

    @pytest.mark.asyncio
    async def test_basic_unpivot(self, unpivot_tool: UnpivotTool, wide_data: pl.LazyFrame):
        """Test basic unpivot operation."""
        config = {
            "on": ["sales_q1", "sales_q2", "sales_q3"],
            "index": ["id", "name"],
            "variableName": "quarter",
            "valueName": "sales",
        }
        result = await unpivot_tool.execute(config, {"input": wide_data})

        assert CommonSockets.OUTPUT in result

        output_df = result[CommonSockets.OUTPUT].collect()

        # 3 rows * 3 columns to unpivot = 9 output rows
        assert len(output_df) == 9

        # Check column names
        assert set(output_df.columns) == {"id", "name", "quarter", "sales"}

        # Check that all quarters are present
        quarters = set(output_df["quarter"].to_list())
        assert quarters == {"sales_q1", "sales_q2", "sales_q3"}

    @pytest.mark.asyncio
    async def test_unpivot_no_index(self, unpivot_tool: UnpivotTool, wide_data: pl.LazyFrame):
        """Test unpivot without index columns."""
        config = {
            "on": ["sales_q1", "sales_q2", "sales_q3"],
            "index": [],
            "variableName": "variable",
            "valueName": "value",
        }
        result = await unpivot_tool.execute(config, {"input": wide_data})

        output_df = result[CommonSockets.OUTPUT].collect()

        # Should only have variable and value columns
        assert set(output_df.columns) == {"variable", "value"}
        assert len(output_df) == 9

    @pytest.mark.asyncio
    async def test_unpivot_single_column(self, unpivot_tool: UnpivotTool, wide_data: pl.LazyFrame):
        """Test unpivot with single column."""
        config = {
            "on": ["sales_q1"],
            "index": ["id"],
            "variableName": "metric",
            "valueName": "amount",
        }
        result = await unpivot_tool.execute(config, {"input": wide_data})

        output_df = result[CommonSockets.OUTPUT].collect()

        # 3 rows * 1 column = 3 output rows
        assert len(output_df) == 3
        assert set(output_df.columns) == {"id", "metric", "amount"}

    @pytest.mark.asyncio
    async def test_unpivot_default_names(self, unpivot_tool: UnpivotTool, wide_data: pl.LazyFrame):
        """Test unpivot with default variable/value names."""
        config = {
            "on": ["sales_q1", "sales_q2"],
            "index": ["id"],
        }
        result = await unpivot_tool.execute(config, {"input": wide_data})

        output_df = result[CommonSockets.OUTPUT].collect()

        # Default names should be "variable" and "value"
        assert "variable" in output_df.columns
        assert "value" in output_df.columns


class TestUnpivotToolSchema:
    """Tests for Unpivot tool schema inference."""

    @pytest.mark.asyncio
    async def test_output_schema_basic(self, unpivot_tool: UnpivotTool, wide_schema: DataSchema):
        """Test output schema calculation."""
        config = {
            "on": ["sales_q1", "sales_q2", "sales_q3"],
            "index": ["id", "name"],
            "variableName": "quarter",
            "valueName": "sales",
        }
        result = await unpivot_tool.get_output_schema(config, {"input": wide_schema})

        assert CommonSockets.OUTPUT in result
        output_schema = result[CommonSockets.OUTPUT]

        # Should have 4 columns: id, name, quarter, sales
        assert len(output_schema.columns) == 4

        column_names = [c.name for c in output_schema.columns]
        assert column_names == ["id", "name", "quarter", "sales"]

        # Variable column should be String
        quarter_col = next(c for c in output_schema.columns if c.name == "quarter")
        assert quarter_col.dtype == PolarsDataType.STRING

    @pytest.mark.asyncio
    async def test_output_schema_preserves_value_type(
        self, unpivot_tool: UnpivotTool, wide_schema: DataSchema
    ):
        """Test that value column type is inferred from input columns."""
        config = {
            "on": ["sales_q1", "sales_q2"],
            "index": ["id"],
            "variableName": "var",
            "valueName": "val",
        }
        result = await unpivot_tool.get_output_schema(config, {"input": wide_schema})

        output_schema = result[CommonSockets.OUTPUT]
        value_col = next(c for c in output_schema.columns if c.name == "val")

        # All unpivoted columns are Int64, so value should be Int64
        assert value_col.dtype == PolarsDataType.INT64


class TestUnpivotToolValidation:
    """Tests for Unpivot tool configuration validation."""

    @pytest.mark.asyncio
    async def test_validation_empty_on(self, unpivot_tool: UnpivotTool):
        """Test validation fails with empty 'on' list."""
        config = {"on": [], "index": ["id"]}
        errors = await unpivot_tool.validate_config(config)
        assert len(errors) > 0
        assert any("at least one column" in e.lower() for e in errors)

    @pytest.mark.asyncio
    async def test_validation_overlap(self, unpivot_tool: UnpivotTool):
        """Test validation fails when columns appear in both on and index."""
        config = {
            "on": ["sales_q1", "id"],
            "index": ["id", "name"],
        }
        errors = await unpivot_tool.validate_config(config)
        assert len(errors) > 0
        assert any("id" in e for e in errors)

    @pytest.mark.asyncio
    async def test_validation_valid_config(self, unpivot_tool: UnpivotTool):
        """Test validation passes with valid config."""
        config = {
            "on": ["sales_q1", "sales_q2"],
            "index": ["id"],
            "variableName": "var",
            "valueName": "val",
        }
        errors = await unpivot_tool.validate_config(config)
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_execute_requires_on(self, unpivot_tool: UnpivotTool, wide_data: pl.LazyFrame):
        """Test execute raises error without 'on' columns."""
        config = {"on": [], "index": ["id"]}
        with pytest.raises(Exception) as exc_info:
            await unpivot_tool.execute(config, {"input": wide_data})
        assert "at least one column" in str(exc_info.value).lower()


class TestUnpivotToolCodeGeneration:
    """Tests for Unpivot tool Python code generation."""

    def test_code_generation_with_index(self, unpivot_tool: UnpivotTool):
        """Test Python code generation with index columns."""
        config = {
            "on": ["sales_q1", "sales_q2"],
            "index": ["id", "name"],
            "variableName": "quarter",
            "valueName": "sales",
        }
        lines, output_vars = unpivot_tool.to_python_code(
            "unpivot_001", config, {"input": "df_input"}
        )

        code = "\n".join(lines)
        assert "unpivot" in code
        assert "sales_q1" in code
        assert "sales_q2" in code
        assert "id" in code
        assert "quarter" in code
        assert "sales" in code

        assert CommonSockets.OUTPUT in output_vars

    def test_code_generation_without_index(self, unpivot_tool: UnpivotTool):
        """Test Python code generation without index columns."""
        config = {
            "on": ["col1", "col2"],
            "index": [],
            "variableName": "var",
            "valueName": "val",
        }
        lines, output_vars = unpivot_tool.to_python_code("unpivot_002", config, {"input": "df_in"})

        code = "\n".join(lines)
        assert "unpivot" in code
        assert "index" not in code.lower() or "index=[]" not in code

        assert CommonSockets.OUTPUT in output_vars
