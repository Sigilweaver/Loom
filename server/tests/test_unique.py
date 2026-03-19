"""Tests for the Unique tool."""

import polars as pl
import pytest

from app.api.models.common import ColumnSchema, DataSchema
from app.domain.tools.implementations.unique import UniqueTool
from app.domain.tools.sockets import UniqueSockets


@pytest.fixture
def unique_tool() -> UniqueTool:
    """Create a UniqueTool instance."""
    return UniqueTool()


@pytest.fixture
def sample_data() -> pl.LazyFrame:
    """Create sample lazy frame for testing."""
    return pl.LazyFrame(
        {
            "name": ["Molly", "Molly", "Molly", "Alice", "Bob", "Alice"],
            "city": ["NYC", "NYC", "LA", "NYC", "LA", "NYC"],
            "value": [1, 2, 3, 4, 5, 6],
        }
    )


@pytest.fixture
def input_schema() -> DataSchema:
    """Create input schema for testing."""
    return DataSchema(
        columns=[
            ColumnSchema(name="name", dtype="String", nullable=True),
            ColumnSchema(name="city", dtype="String", nullable=True),
            ColumnSchema(name="value", dtype="Int64", nullable=True),
        ]
    )


class TestUniqueToolBlocking:
    """Tests for Unique tool blocking behavior."""

    def test_is_always_blocking(self, unique_tool: UniqueTool):
        """Unique is always blocking regardless of config."""
        assert unique_tool.is_blocking({}) is True
        assert unique_tool.is_blocking({"mode": "First"}) is True
        assert unique_tool.is_blocking({"mode": "Strict"}) is True
        assert unique_tool.is_blocking(None) is True

    def test_should_cache(self, unique_tool: UniqueTool):
        """Unique should always cache since it's blocking."""
        assert unique_tool.should_cache({}) is True
        assert unique_tool.should_cache({"mode": "First"}) is True
        assert unique_tool.should_cache({"mode": "Strict"}) is True


class TestUniqueToolFirstMode:
    """Tests for Unique tool First mode."""

    @pytest.mark.asyncio
    async def test_first_mode_single_column(
        self, unique_tool: UniqueTool, sample_data: pl.LazyFrame
    ):
        """First mode keeps first occurrence, sends subsequent to duplicates."""
        config = {"mode": "First", "columns": ["name"]}
        result = await unique_tool.execute(config, {"input": sample_data})

        assert UniqueSockets.OUTPUT_UNIQUE in result
        assert UniqueSockets.OUTPUT_DUPLICATE in result

        unique_df = result[UniqueSockets.OUTPUT_UNIQUE].collect()
        duplicate_df = result[UniqueSockets.OUTPUT_DUPLICATE].collect()

        # Should have 3 unique names: Molly (first), Alice (first), Bob
        assert len(unique_df) == 3
        unique_names = set(unique_df["name"].to_list())
        assert unique_names == {"Molly", "Alice", "Bob"}

        # Should have 3 duplicates: 2 more Mollys, 1 more Alice
        assert len(duplicate_df) == 3

    @pytest.mark.asyncio
    async def test_first_mode_preserves_first_row(self, unique_tool: UniqueTool):
        """First mode preserves the actual first row for each key."""
        lf = pl.LazyFrame(
            {
                "name": ["Molly", "Molly", "Molly"],
                "value": [1, 2, 3],
            }
        )
        config = {"mode": "First", "columns": ["name"]}
        result = await unique_tool.execute(config, {"input": lf})

        unique_df = result[UniqueSockets.OUTPUT_UNIQUE].collect()
        duplicate_df = result[UniqueSockets.OUTPUT_DUPLICATE].collect()

        # Unique should have first Molly with value=1
        assert len(unique_df) == 1
        assert unique_df["value"].to_list() == [1]

        # Duplicates should have the other two
        assert len(duplicate_df) == 2
        assert set(duplicate_df["value"].to_list()) == {2, 3}

    @pytest.mark.asyncio
    async def test_first_mode_multi_column(
        self, unique_tool: UniqueTool, sample_data: pl.LazyFrame
    ):
        """First mode works with multiple columns."""
        config = {"mode": "First", "columns": ["name", "city"]}
        result = await unique_tool.execute(config, {"input": sample_data})

        unique_df = result[UniqueSockets.OUTPUT_UNIQUE].collect()
        duplicate_df = result[UniqueSockets.OUTPUT_DUPLICATE].collect()

        # Unique combinations: (Molly, NYC), (Molly, LA), (Alice, NYC), (Bob, LA)
        assert len(unique_df) == 4
        # Duplicates: second (Molly, NYC), second (Alice, NYC)
        assert len(duplicate_df) == 2

    @pytest.mark.asyncio
    async def test_first_mode_all_columns_default(
        self, unique_tool: UniqueTool, sample_data: pl.LazyFrame
    ):
        """First mode uses all columns when columns list is empty."""
        config = {"mode": "First", "columns": []}
        result = await unique_tool.execute(config, {"input": sample_data})

        unique_df = result[UniqueSockets.OUTPUT_UNIQUE].collect()
        duplicate_df = result[UniqueSockets.OUTPUT_DUPLICATE].collect()

        # All rows are unique when considering all columns
        assert len(unique_df) == 6
        assert len(duplicate_df) == 0


class TestUniqueToolStrictMode:
    """Tests for Unique tool Strict mode."""

    @pytest.mark.asyncio
    async def test_strict_mode_single_column(
        self, unique_tool: UniqueTool, sample_data: pl.LazyFrame
    ):
        """Strict mode only keeps values that appear exactly once."""
        config = {"mode": "Strict", "columns": ["name"]}
        result = await unique_tool.execute(config, {"input": sample_data})

        unique_df = result[UniqueSockets.OUTPUT_UNIQUE].collect()
        duplicate_df = result[UniqueSockets.OUTPUT_DUPLICATE].collect()

        # Only Bob appears exactly once
        assert len(unique_df) == 1
        assert unique_df["name"].to_list() == ["Bob"]

        # All Mollys and Alices go to duplicates (5 rows)
        assert len(duplicate_df) == 5

    @pytest.mark.asyncio
    async def test_strict_mode_includes_all_duplicated_rows(self, unique_tool: UniqueTool):
        """Strict mode sends ALL rows with duplicated values to duplicate output."""
        lf = pl.LazyFrame(
            {
                "name": ["Molly", "Molly", "Bob"],
                "value": [1, 2, 3],
            }
        )
        config = {"mode": "Strict", "columns": ["name"]}
        result = await unique_tool.execute(config, {"input": lf})

        unique_df = result[UniqueSockets.OUTPUT_UNIQUE].collect()
        duplicate_df = result[UniqueSockets.OUTPUT_DUPLICATE].collect()

        # Only Bob is unique
        assert len(unique_df) == 1
        assert unique_df["name"].to_list() == ["Bob"]

        # Both Mollys go to duplicates (including the first one)
        assert len(duplicate_df) == 2
        assert set(duplicate_df["value"].to_list()) == {1, 2}


class TestUniqueToolSchema:
    """Tests for Unique tool schema handling."""

    @pytest.mark.asyncio
    async def test_output_schema_matches_input(
        self, unique_tool: UniqueTool, input_schema: DataSchema
    ):
        """Both outputs have same schema as input."""
        config = {"mode": "First", "columns": ["name"]}
        result = await unique_tool.get_output_schema(config, {"input": input_schema})

        assert UniqueSockets.OUTPUT_UNIQUE in result
        assert UniqueSockets.OUTPUT_DUPLICATE in result

        assert result[UniqueSockets.OUTPUT_UNIQUE] == input_schema
        assert result[UniqueSockets.OUTPUT_DUPLICATE] == input_schema


class TestUniqueToolValidation:
    """Tests for Unique tool config validation."""

    @pytest.mark.asyncio
    async def test_valid_config(self, unique_tool: UniqueTool):
        """Valid config passes validation."""
        errors = await unique_tool.validate_config(
            {
                "mode": "First",
                "columns": ["name", "city"],
            }
        )
        assert errors == []

    @pytest.mark.asyncio
    async def test_invalid_mode(self, unique_tool: UniqueTool):
        """Invalid mode is rejected."""
        errors = await unique_tool.validate_config(
            {
                "mode": "Invalid",
                "columns": [],
            }
        )
        assert len(errors) == 1
        assert "Invalid unique mode" in errors[0]

    @pytest.mark.asyncio
    async def test_invalid_columns_type(self, unique_tool: UniqueTool):
        """Non-list columns is rejected."""
        errors = await unique_tool.validate_config(
            {
                "mode": "First",
                "columns": "name",  # Should be a list
            }
        )
        assert len(errors) == 1
        assert "must be a list" in errors[0]

    @pytest.mark.asyncio
    async def test_invalid_column_names(self, unique_tool: UniqueTool):
        """Non-string column names are rejected."""
        errors = await unique_tool.validate_config(
            {
                "mode": "First",
                "columns": ["name", 123],  # 123 is not a string
            }
        )
        assert len(errors) == 1
        assert "must be strings" in errors[0]

    @pytest.mark.asyncio
    async def test_empty_config_defaults(self, unique_tool: UniqueTool):
        """Empty config uses defaults and is valid."""
        errors = await unique_tool.validate_config({})
        assert errors == []


class TestUniqueToolCodeGeneration:
    """Tests for Unique tool Python code generation."""

    def test_code_generation_first_mode(self, unique_tool: UniqueTool):
        """Code generation for First mode with specific columns."""
        lines, output_vars = unique_tool.to_python_code(
            tool_id="unique_1",
            config={"mode": "First", "columns": ["name", "city"]},
            input_vars={"input": "df_input"},
        )

        code = "\n".join(lines)
        assert 'pl.struct(["name", "city"])' in code
        assert "is_first_distinct()" in code
        assert UniqueSockets.OUTPUT_UNIQUE in output_vars
        assert UniqueSockets.OUTPUT_DUPLICATE in output_vars

    def test_code_generation_strict_mode(self, unique_tool: UniqueTool):
        """Code generation for Strict mode."""
        lines, output_vars = unique_tool.to_python_code(
            tool_id="unique_2",
            config={"mode": "Strict", "columns": ["name"]},
            input_vars={"input": "df_input"},
        )

        code = "\n".join(lines)
        assert "is_unique()" in code
        assert "is_first_distinct" not in code

    def test_code_generation_all_columns(self, unique_tool: UniqueTool):
        """Code generation for all columns (empty list)."""
        lines, output_vars = unique_tool.to_python_code(
            tool_id="unique_3",
            config={"mode": "First", "columns": []},
            input_vars={"input": "df_input"},
        )

        code = "\n".join(lines)
        assert "collect_schema().names()" in code
        assert "pl.struct(_all_cols)" in code


class TestUniqueToolEdgeCases:
    """Tests for edge cases and special scenarios."""

    @pytest.mark.asyncio
    async def test_empty_input(self, unique_tool: UniqueTool):
        """Empty input produces empty outputs."""
        lf = pl.LazyFrame({"name": [], "value": []})
        config = {"mode": "First", "columns": ["name"]}
        result = await unique_tool.execute(config, {"input": lf})

        unique_df = result[UniqueSockets.OUTPUT_UNIQUE].collect()
        duplicate_df = result[UniqueSockets.OUTPUT_DUPLICATE].collect()

        assert len(unique_df) == 0
        assert len(duplicate_df) == 0

    @pytest.mark.asyncio
    async def test_all_unique_values(self, unique_tool: UniqueTool):
        """All unique values go to unique output, none to duplicates."""
        lf = pl.LazyFrame(
            {
                "name": ["Alice", "Bob", "Charlie"],
                "value": [1, 2, 3],
            }
        )
        config = {"mode": "First", "columns": ["name"]}
        result = await unique_tool.execute(config, {"input": lf})

        unique_df = result[UniqueSockets.OUTPUT_UNIQUE].collect()
        duplicate_df = result[UniqueSockets.OUTPUT_DUPLICATE].collect()

        assert len(unique_df) == 3
        assert len(duplicate_df) == 0

    @pytest.mark.asyncio
    async def test_all_same_value(self, unique_tool: UniqueTool):
        """All same values - first to unique, rest to duplicates."""
        lf = pl.LazyFrame(
            {
                "name": ["Molly", "Molly", "Molly"],
                "value": [1, 2, 3],
            }
        )
        config = {"mode": "First", "columns": ["name"]}
        result = await unique_tool.execute(config, {"input": lf})

        unique_df = result[UniqueSockets.OUTPUT_UNIQUE].collect()
        duplicate_df = result[UniqueSockets.OUTPUT_DUPLICATE].collect()

        assert len(unique_df) == 1
        assert len(duplicate_df) == 2

    @pytest.mark.asyncio
    async def test_null_handling(self, unique_tool: UniqueTool):
        """Nulls are treated as equal (multiple nulls = duplicates)."""
        lf = pl.LazyFrame(
            {
                "name": [None, None, "Bob"],
                "value": [1, 2, 3],
            }
        )
        config = {"mode": "First", "columns": ["name"]}
        result = await unique_tool.execute(config, {"input": lf})

        unique_df = result[UniqueSockets.OUTPUT_UNIQUE].collect()
        duplicate_df = result[UniqueSockets.OUTPUT_DUPLICATE].collect()

        # First null and Bob are unique
        assert len(unique_df) == 2
        # Second null is duplicate
        assert len(duplicate_df) == 1
