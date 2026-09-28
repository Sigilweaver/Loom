"""Tests for the Sample tool."""

import polars as pl
import pytest

from app.domain.tools.implementations.sample import SampleTool


@pytest.fixture
def sample_data() -> pl.LazyFrame:
    """Create sample lazy frame for testing."""
    return pl.LazyFrame(
        {
            "id": list(range(1, 101)),  # 1-100
            "name": [f"Item_{i}" for i in range(1, 101)],
            "value": [i * 10.0 for i in range(1, 101)],
        }
    )


@pytest.fixture
def sample_tool() -> SampleTool:
    """Create a SampleTool instance."""
    return SampleTool()


class TestSampleToolBlocking:
    """Tests for Sample tool blocking behavior."""

    def test_first_n_not_blocking(self, sample_tool: SampleTool):
        """FirstN mode is not blocking."""
        assert sample_tool.is_blocking({"mode": "FirstN"}) is False
        assert sample_tool.should_cache({"mode": "FirstN"}) is False

    def test_last_n_is_blocking(self, sample_tool: SampleTool):
        """LastN mode is blocking."""
        assert sample_tool.is_blocking({"mode": "LastN"}) is True
        assert sample_tool.should_cache({"mode": "LastN"}) is True

    def test_every_n_not_blocking(self, sample_tool: SampleTool):
        """EveryN mode is not blocking."""
        assert sample_tool.is_blocking({"mode": "EveryN"}) is False
        assert sample_tool.should_cache({"mode": "EveryN"}) is False

    def test_random_is_blocking(self, sample_tool: SampleTool):
        """Random mode is blocking."""
        assert sample_tool.is_blocking({"mode": "Random"}) is True
        assert sample_tool.should_cache({"mode": "Random"}) is True

    def test_random_percent_is_blocking(self, sample_tool: SampleTool):
        """RandomPercent mode is blocking."""
        assert sample_tool.is_blocking({"mode": "RandomPercent"}) is True
        assert sample_tool.should_cache({"mode": "RandomPercent"}) is True

    def test_first_percent_is_blocking(self, sample_tool: SampleTool):
        """FirstPercent mode is blocking."""
        assert sample_tool.is_blocking({"mode": "FirstPercent"}) is True
        assert sample_tool.should_cache({"mode": "FirstPercent"}) is True

    def test_default_config_not_blocking(self, sample_tool: SampleTool):
        """Default config (FirstN) is not blocking."""
        assert sample_tool.is_blocking({}) is False
        assert sample_tool.is_blocking(None) is False


class TestSampleToolExecution:
    """Tests for SampleTool.execute()."""

    @pytest.mark.asyncio
    async def test_first_n(self, sample_tool: SampleTool, sample_data: pl.LazyFrame):
        """Test FirstN mode takes first N rows."""
        config = {"mode": "FirstN", "n": 10}
        result = await sample_tool.execute(config, {"input": sample_data})

        assert "output" in result
        df = result["output"].collect()

        assert len(df) == 10
        assert df["id"].to_list() == list(range(1, 11))

    @pytest.mark.asyncio
    async def test_last_n(self, sample_tool: SampleTool, sample_data: pl.LazyFrame):
        """Test LastN mode takes last N rows."""
        config = {"mode": "LastN", "n": 10}
        result = await sample_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()

        assert len(df) == 10
        assert df["id"].to_list() == list(range(91, 101))

    @pytest.mark.asyncio
    async def test_every_n(self, sample_tool: SampleTool, sample_data: pl.LazyFrame):
        """Test EveryN mode takes every Nth row."""
        config = {"mode": "EveryN", "n": 10}
        result = await sample_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()

        # Every 10th row starting from 0: rows 0, 10, 20, ... (ids 1, 11, 21, ...)
        assert len(df) == 10
        assert df["id"].to_list() == [1, 11, 21, 31, 41, 51, 61, 71, 81, 91]

    @pytest.mark.asyncio
    async def test_every_n_with_offset(self, sample_tool: SampleTool, sample_data: pl.LazyFrame):
        """Test EveryN mode with offset."""
        config = {"mode": "EveryN", "n": 10, "offset": 5}
        result = await sample_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()

        # Every 10th row starting from offset 5: rows 5, 15, 25, ... (ids 6, 16, 26, ...)
        assert len(df) == 10
        assert df["id"].to_list() == [6, 16, 26, 36, 46, 56, 66, 76, 86, 96]

    @pytest.mark.asyncio
    async def test_random_with_seed(self, sample_tool: SampleTool, sample_data: pl.LazyFrame):
        """Test Random mode with seed for reproducibility."""
        config = {"mode": "Random", "n": 10, "seed": 42}

        # Run twice with same seed
        result1 = await sample_tool.execute(config, {"input": sample_data})
        result2 = await sample_tool.execute(config, {"input": sample_data})

        df1 = result1["output"].collect()
        df2 = result2["output"].collect()

        assert len(df1) == 10
        assert len(df2) == 10
        # Same seed should produce same results
        assert df1["id"].to_list() == df2["id"].to_list()

    @pytest.mark.asyncio
    async def test_random_percent(self, sample_tool: SampleTool, sample_data: pl.LazyFrame):
        """Test RandomPercent mode."""
        config = {"mode": "RandomPercent", "percent": 10.0, "seed": 42}
        result = await sample_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()

        # 10% of 100 rows = ~10 rows (may vary slightly due to rounding)
        assert 5 <= len(df) <= 15

    @pytest.mark.asyncio
    async def test_first_percent(self, sample_tool: SampleTool, sample_data: pl.LazyFrame):
        """Test FirstPercent mode."""
        config = {"mode": "FirstPercent", "percent": 25.0}
        result = await sample_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()

        # First 25% of 100 rows = 25 rows
        assert len(df) == 25
        assert df["id"].to_list() == list(range(1, 26))

    @pytest.mark.asyncio
    async def test_default_mode(self, sample_tool: SampleTool, sample_data: pl.LazyFrame):
        """Test default mode (FirstN with n=100)."""
        config = {}
        result = await sample_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()
        assert len(df) == 100  # Default n=100, matches our data size

    @pytest.mark.asyncio
    async def test_n_larger_than_data(self, sample_tool: SampleTool, sample_data: pl.LazyFrame):
        """Test when n is larger than data size."""
        config = {"mode": "FirstN", "n": 1000}
        result = await sample_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()
        assert len(df) == 100  # All rows returned

    @pytest.mark.asyncio
    async def test_random_n_larger_than_data(
        self, sample_tool: SampleTool, sample_data: pl.LazyFrame
    ):
        """Test Random mode when n is larger than data size."""
        config = {"mode": "Random", "n": 1000, "seed": 42}
        result = await sample_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()
        assert len(df) == 100  # Can't sample more than exists


class TestSampleToolValidation:
    """Tests for SampleTool.validate_config()."""

    @pytest.mark.asyncio
    async def test_valid_config(self, sample_tool: SampleTool):
        """Test valid configuration."""
        config = {"mode": "FirstN", "n": 100}
        errors = await sample_tool.validate_config(config)
        assert errors == []

    @pytest.mark.asyncio
    async def test_invalid_mode(self, sample_tool: SampleTool):
        """Test invalid mode."""
        config = {"mode": "InvalidMode", "n": 100}
        errors = await sample_tool.validate_config(config)
        assert len(errors) == 1
        assert "Invalid sample mode" in errors[0]

    @pytest.mark.asyncio
    async def test_invalid_n(self, sample_tool: SampleTool):
        """Test invalid n value."""
        config = {"mode": "FirstN", "n": -5}
        errors = await sample_tool.validate_config(config)
        assert len(errors) == 1
        assert "positive integer" in errors[0]

    @pytest.mark.asyncio
    async def test_invalid_percent(self, sample_tool: SampleTool):
        """Test invalid percent value."""
        config = {"mode": "RandomPercent", "percent": 150}
        errors = await sample_tool.validate_config(config)
        assert len(errors) == 1
        assert "between 0 and 100" in errors[0]

    @pytest.mark.asyncio
    async def test_invalid_offset(self, sample_tool: SampleTool):
        """Test invalid offset value."""
        config = {"mode": "EveryN", "n": 10, "offset": -1}
        errors = await sample_tool.validate_config(config)
        assert len(errors) == 1
        assert "non-negative integer" in errors[0]


class TestSampleToolSchema:
    """Tests for SampleTool.get_output_schema()."""

    @pytest.mark.asyncio
    async def test_schema_preserved(self, sample_tool: SampleTool):
        """Test that sample preserves schema."""
        from app.domain.models.common import ColumnSchema, DataSchema, PolarsDataType

        input_schema = DataSchema(
            columns=[
                ColumnSchema(name="id", dtype=PolarsDataType.INT64, nullable=False),
                ColumnSchema(name="name", dtype=PolarsDataType.STRING, nullable=False),
                ColumnSchema(name="value", dtype=PolarsDataType.FLOAT64, nullable=False),
            ]
        )

        config = {"mode": "FirstN", "n": 10}
        result = await sample_tool.get_output_schema(config, {"input": input_schema})

        assert "output" in result
        assert result["output"] == input_schema


class TestSampleToolCodeGeneration:
    """Tests for SampleTool.to_python_code()."""

    def test_first_n_code(self, sample_tool: SampleTool):
        """Test code generation for FirstN mode."""
        config = {"mode": "FirstN", "n": 50}
        lines, output_vars = sample_tool.to_python_code("sample-1", config, {"input": "df_input"})

        assert len(lines) == 1
        assert "df_sample_1" in lines[0]
        assert ".head(50)" in lines[0]
        assert output_vars == {"output": "df_sample_1"}

    def test_last_n_code(self, sample_tool: SampleTool):
        """Test code generation for LastN mode."""
        config = {"mode": "LastN", "n": 25}
        lines, output_vars = sample_tool.to_python_code("sample-2", config, {"input": "df_input"})

        assert len(lines) == 1
        assert ".tail(25)" in lines[0]

    def test_every_n_code(self, sample_tool: SampleTool):
        """Test code generation for EveryN mode."""
        config = {"mode": "EveryN", "n": 10}
        lines, output_vars = sample_tool.to_python_code("sample-3", config, {"input": "df_input"})

        assert len(lines) == 1
        assert ".gather_every(10)" in lines[0]

    def test_every_n_with_offset_code(self, sample_tool: SampleTool):
        """Test code generation for EveryN mode with offset."""
        config = {"mode": "EveryN", "n": 10, "offset": 5}
        lines, output_vars = sample_tool.to_python_code("sample-4", config, {"input": "df_input"})

        assert len(lines) == 1
        assert ".gather_every(10, offset=5)" in lines[0]

    def test_random_code(self, sample_tool: SampleTool):
        """Test code generation for Random mode."""
        config = {"mode": "Random", "n": 20, "seed": 42}
        lines, output_vars = sample_tool.to_python_code("sample-5", config, {"input": "df_input"})

        assert len(lines) == 2
        assert ".collect()" in lines[0]
        assert ".sample(" in lines[1]
        assert "seed=42" in lines[1]

    def test_random_percent_code(self, sample_tool: SampleTool):
        """Test code generation for RandomPercent mode."""
        config = {"mode": "RandomPercent", "percent": 15.0}
        lines, output_vars = sample_tool.to_python_code("sample-6", config, {"input": "df_input"})

        assert len(lines) == 2
        assert ".collect()" in lines[0]
        assert "fraction=" in lines[1]

    def test_first_percent_code(self, sample_tool: SampleTool):
        """Test code generation for FirstPercent mode."""
        config = {"mode": "FirstPercent", "percent": 30.0}
        lines, output_vars = sample_tool.to_python_code("sample-7", config, {"input": "df_input"})

        assert len(lines) == 3
        assert ".collect()" in lines[0]
        assert "30.0 / 100.0" in lines[1]
        assert ".head(" in lines[2]
