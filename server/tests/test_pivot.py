"""Tests for the Pivot tool."""
import polars as pl
import pytest

from app.api.models.common import ColumnSchema, DataSchema, PolarsDataType
from app.domain.tools.implementations.pivot import PivotTool, PIVOT_AGGREGATIONS
from app.domain.tools.sockets import CommonSockets


@pytest.fixture
def pivot_tool() -> PivotTool:
    """Create a PivotTool instance."""
    return PivotTool()


@pytest.fixture
def long_data() -> pl.LazyFrame:
    """Create sample long format data for testing."""
    return pl.LazyFrame({
        "id": [1, 1, 1, 2, 2, 2],
        "name": ["Alice", "Alice", "Alice", "Bob", "Bob", "Bob"],
        "quarter": ["Q1", "Q2", "Q3", "Q1", "Q2", "Q3"],
        "sales": [100, 110, 120, 200, 180, 220],
    })


@pytest.fixture
def long_data_with_duplicates() -> pl.LazyFrame:
    """Create sample data with duplicate pivot keys for aggregation testing."""
    return pl.LazyFrame({
        "id": [1, 1, 1, 1, 2, 2],
        "quarter": ["Q1", "Q1", "Q2", "Q2", "Q1", "Q1"],
        "sales": [100, 150, 110, 90, 200, 250],
    })


@pytest.fixture
def long_schema() -> DataSchema:
    """Create input schema for long format data."""
    return DataSchema(columns=[
        ColumnSchema(name="id", dtype=PolarsDataType.INT64, nullable=True),
        ColumnSchema(name="name", dtype=PolarsDataType.STRING, nullable=True),
        ColumnSchema(name="quarter", dtype=PolarsDataType.STRING, nullable=True),
        ColumnSchema(name="sales", dtype=PolarsDataType.INT64, nullable=True),
    ])


class TestPivotToolBlocking:
    """Tests for Pivot tool blocking behavior."""

    def test_is_blocking(self, pivot_tool: PivotTool):
        """Pivot is always blocking - must scan all data."""
        assert pivot_tool.is_blocking({}) is True
        assert pivot_tool.is_blocking(None) is True

    def test_should_cache(self, pivot_tool: PivotTool):
        """Pivot should always cache since it's blocking."""
        assert pivot_tool.should_cache({}) is True


class TestPivotToolBasic:
    """Basic pivot functionality tests."""

    @pytest.mark.asyncio
    async def test_basic_pivot(
        self, pivot_tool: PivotTool, long_data: pl.LazyFrame
    ):
        """Test basic pivot operation."""
        config = {
            "on": "quarter",
            "index": ["id", "name"],
            "values": "sales",
            "aggregateFunction": "first",
        }
        result = await pivot_tool.execute(config, {"input": long_data})

        assert CommonSockets.OUTPUT in result

        output_df = result[CommonSockets.OUTPUT].collect()

        # Should have 2 rows (one per id/name combination)
        assert len(output_df) == 2

        # Should have columns: id, name, Q1, Q2, Q3
        assert "id" in output_df.columns
        assert "name" in output_df.columns
        assert "Q1" in output_df.columns
        assert "Q2" in output_df.columns
        assert "Q3" in output_df.columns

    @pytest.mark.asyncio
    async def test_pivot_single_index(
        self, pivot_tool: PivotTool, long_data: pl.LazyFrame
    ):
        """Test pivot with single index column."""
        config = {
            "on": "quarter",
            "index": ["id"],
            "values": "sales",
            "aggregateFunction": "first",
        }
        result = await pivot_tool.execute(config, {"input": long_data})

        output_df = result[CommonSockets.OUTPUT].collect()

        # Should have 2 rows (one per id)
        assert len(output_df) == 2
        assert "id" in output_df.columns
        assert "name" not in output_df.columns

    @pytest.mark.asyncio
    async def test_pivot_requires_index(
        self, pivot_tool: PivotTool
    ):
        """Test that pivot requires at least one index column (Polars requirement)."""
        config = {
            "on": "category",
            "index": [],
            "values": "value",
            "aggregateFunction": "first",
        }
        errors = await pivot_tool.validate_config(config)
        assert len(errors) == 1
        assert "index column" in errors[0].lower()


class TestPivotToolAggregation:
    """Tests for Pivot tool aggregation functions."""

    @pytest.mark.asyncio
    async def test_aggregation_first(
        self, pivot_tool: PivotTool, long_data_with_duplicates: pl.LazyFrame
    ):
        """Test pivot with first aggregation."""
        config = {
            "on": "quarter",
            "index": ["id"],
            "values": "sales",
            "aggregateFunction": "first",
        }
        result = await pivot_tool.execute(config, {"input": long_data_with_duplicates})

        output_df = result[CommonSockets.OUTPUT].collect()

        # Check that first value is taken for id=1, Q1 (should be 100, not 150)
        row1 = output_df.filter(pl.col("id") == 1)
        q1_val = row1["Q1"].to_list()[0]
        assert q1_val == 100

    @pytest.mark.asyncio
    async def test_aggregation_sum(
        self, pivot_tool: PivotTool, long_data_with_duplicates: pl.LazyFrame
    ):
        """Test pivot with sum aggregation."""
        config = {
            "on": "quarter",
            "index": ["id"],
            "values": "sales",
            "aggregateFunction": "sum",
        }
        result = await pivot_tool.execute(config, {"input": long_data_with_duplicates})

        output_df = result[CommonSockets.OUTPUT].collect()

        # Check sum for id=1, Q1 (100 + 150 = 250)
        row1 = output_df.filter(pl.col("id") == 1)
        q1_val = row1["Q1"].to_list()[0]
        assert q1_val == 250

        # Check sum for id=1, Q2 (110 + 90 = 200)
        q2_val = row1["Q2"].to_list()[0]
        assert q2_val == 200

    @pytest.mark.asyncio
    async def test_aggregation_mean(
        self, pivot_tool: PivotTool, long_data_with_duplicates: pl.LazyFrame
    ):
        """Test pivot with mean aggregation."""
        config = {
            "on": "quarter",
            "index": ["id"],
            "values": "sales",
            "aggregateFunction": "mean",
        }
        result = await pivot_tool.execute(config, {"input": long_data_with_duplicates})

        output_df = result[CommonSockets.OUTPUT].collect()

        # Check mean for id=1, Q1 ((100 + 150) / 2 = 125)
        row1 = output_df.filter(pl.col("id") == 1)
        q1_val = row1["Q1"].to_list()[0]
        assert q1_val == 125.0

    @pytest.mark.asyncio
    async def test_aggregation_len(
        self, pivot_tool: PivotTool, long_data_with_duplicates: pl.LazyFrame
    ):
        """Test pivot with len aggregation."""
        config = {
            "on": "quarter",
            "index": ["id"],
            "values": "sales",
            "aggregateFunction": "len",
        }
        result = await pivot_tool.execute(config, {"input": long_data_with_duplicates})

        output_df = result[CommonSockets.OUTPUT].collect()

        # Check count for id=1, Q1 (2 values)
        row1 = output_df.filter(pl.col("id") == 1)
        q1_val = row1["Q1"].to_list()[0]
        assert q1_val == 2

    @pytest.mark.asyncio
    async def test_aggregation_min_max(
        self, pivot_tool: PivotTool, long_data_with_duplicates: pl.LazyFrame
    ):
        """Test pivot with min/max aggregations."""
        # Test min
        config_min = {
            "on": "quarter",
            "index": ["id"],
            "values": "sales",
            "aggregateFunction": "min",
        }
        result_min = await pivot_tool.execute(config_min, {"input": long_data_with_duplicates})
        output_min = result_min[CommonSockets.OUTPUT].collect()

        row1_min = output_min.filter(pl.col("id") == 1)
        assert row1_min["Q1"].to_list()[0] == 100  # min(100, 150)

        # Test max
        config_max = {
            "on": "quarter",
            "index": ["id"],
            "values": "sales",
            "aggregateFunction": "max",
        }
        result_max = await pivot_tool.execute(config_max, {"input": long_data_with_duplicates})
        output_max = result_max[CommonSockets.OUTPUT].collect()

        row1_max = output_max.filter(pl.col("id") == 1)
        assert row1_max["Q1"].to_list()[0] == 150  # max(100, 150)


class TestPivotToolSchema:
    """Tests for Pivot tool schema inference."""

    @pytest.mark.asyncio
    async def test_output_schema_index_only(
        self, pivot_tool: PivotTool, long_schema: DataSchema
    ):
        """Test output schema contains index columns.

        Note: Pivot output schema cannot determine pivoted columns without data.
        """
        config = {
            "on": "quarter",
            "index": ["id", "name"],
            "values": "sales",
            "aggregateFunction": "first",
        }
        result = await pivot_tool.get_output_schema(config, {"input": long_schema})

        assert CommonSockets.OUTPUT in result
        output_schema = result[CommonSockets.OUTPUT]

        # Should have index columns at minimum
        column_names = [c.name for c in output_schema.columns]
        assert "id" in column_names
        assert "name" in column_names


class TestPivotToolValidation:
    """Tests for Pivot tool configuration validation."""

    @pytest.mark.asyncio
    async def test_validation_missing_on(self, pivot_tool: PivotTool):
        """Test validation fails without pivot column."""
        config = {"on": "", "index": ["id"], "values": "sales"}
        errors = await pivot_tool.validate_config(config)
        assert len(errors) > 0
        assert any("pivot" in e.lower() for e in errors)

    @pytest.mark.asyncio
    async def test_validation_missing_values(self, pivot_tool: PivotTool):
        """Test validation fails without values column."""
        config = {"on": "quarter", "index": ["id"], "values": ""}
        errors = await pivot_tool.validate_config(config)
        assert len(errors) > 0
        assert any("values" in e.lower() for e in errors)

    @pytest.mark.asyncio
    async def test_validation_on_in_index(self, pivot_tool: PivotTool):
        """Test validation fails when pivot column is in index."""
        config = {
            "on": "quarter",
            "index": ["id", "quarter"],
            "values": "sales",
        }
        errors = await pivot_tool.validate_config(config)
        assert len(errors) > 0
        assert any("quarter" in e for e in errors)

    @pytest.mark.asyncio
    async def test_validation_values_in_index(self, pivot_tool: PivotTool):
        """Test validation fails when values column is in index."""
        config = {
            "on": "quarter",
            "index": ["id", "sales"],
            "values": "sales",
        }
        errors = await pivot_tool.validate_config(config)
        assert len(errors) > 0
        assert any("sales" in e for e in errors)

    @pytest.mark.asyncio
    async def test_validation_invalid_aggregation(self, pivot_tool: PivotTool):
        """Test validation fails with invalid aggregation function."""
        config = {
            "on": "quarter",
            "index": ["id"],
            "values": "sales",
            "aggregateFunction": "invalid_agg",
        }
        errors = await pivot_tool.validate_config(config)
        assert len(errors) > 0
        assert any("aggregate" in e.lower() or "invalid" in e.lower() for e in errors)

    @pytest.mark.asyncio
    async def test_validation_valid_config(self, pivot_tool: PivotTool):
        """Test validation passes with valid config."""
        config = {
            "on": "quarter",
            "index": ["id"],
            "values": "sales",
            "aggregateFunction": "sum",
        }
        errors = await pivot_tool.validate_config(config)
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_execute_requires_on(
        self, pivot_tool: PivotTool, long_data: pl.LazyFrame
    ):
        """Test execute raises error without 'on' column."""
        config = {"on": "", "index": ["id"], "values": "sales"}
        with pytest.raises(Exception) as exc_info:
            await pivot_tool.execute(config, {"input": long_data})
        assert "pivot" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_execute_requires_values(
        self, pivot_tool: PivotTool, long_data: pl.LazyFrame
    ):
        """Test execute raises error without values column."""
        config = {"on": "quarter", "index": ["id"], "values": ""}
        with pytest.raises(Exception) as exc_info:
            await pivot_tool.execute(config, {"input": long_data})
        assert "values" in str(exc_info.value).lower()


class TestPivotToolCodeGeneration:
    """Tests for Pivot tool Python code generation."""

    def test_code_generation_with_index(self, pivot_tool: PivotTool):
        """Test Python code generation with index columns."""
        config = {
            "on": "quarter",
            "index": ["id", "name"],
            "values": "sales",
            "aggregateFunction": "sum",
        }
        lines, output_vars = pivot_tool.to_python_code(
            "pivot_001", config, {"input": "df_input"}
        )

        code = "\n".join(lines)
        assert "pivot" in code
        assert "quarter" in code
        assert "id" in code
        assert "sales" in code
        assert "sum" in code

        assert CommonSockets.OUTPUT in output_vars

    def test_code_generation_without_index(self, pivot_tool: PivotTool):
        """Test Python code generation without index columns."""
        config = {
            "on": "category",
            "index": [],
            "values": "value",
            "aggregateFunction": "first",
        }
        lines, output_vars = pivot_tool.to_python_code(
            "pivot_002", config, {"input": "df_in"}
        )

        code = "\n".join(lines)
        assert "pivot" in code
        assert "category" in code
        assert "value" in code

        assert CommonSockets.OUTPUT in output_vars

    def test_code_generation_default_aggregation(self, pivot_tool: PivotTool):
        """Test code generation uses first as default aggregation."""
        config = {
            "on": "col",
            "index": ["id"],
            "values": "val",
        }
        lines, _ = pivot_tool.to_python_code(
            "pivot_003", config, {"input": "df"}
        )

        code = "\n".join(lines)
        assert "first" in code


class TestPivotAggregationList:
    """Tests to verify available aggregation functions."""

    def test_all_aggregations_defined(self):
        """Test that all expected aggregations are defined."""
        expected = {"first", "last", "sum", "mean", "median", "min", "max", "len"}
        assert set(PIVOT_AGGREGATIONS.keys()) == expected
