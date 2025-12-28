"""Tests for the Sort tool."""
import polars as pl
import pytest

from app.domain.tools.implementations.sort import SortTool


@pytest.fixture
def sample_data() -> pl.LazyFrame:
    """Create sample lazy frame for testing."""
    return pl.LazyFrame({
        "name": ["Alice", "Bob", "Charlie", "David", None],
        "age": [30, 25, 35, 25, 40],
        "city": ["NYC", "LA", "NYC", "Chicago", "LA"],
        "salary": [50000.0, 60000.0, 55000.0, 45000.0, 70000.0],
    })


@pytest.fixture
def sort_tool() -> SortTool:
    """Create a SortTool instance."""
    return SortTool()


class TestSortToolExecution:
    """Tests for SortTool.execute()."""

    @pytest.mark.asyncio
    async def test_sort_single_column_ascending(
        self, sort_tool: SortTool, sample_data: pl.LazyFrame
    ):
        """Test sorting by a single column in ascending order."""
        config = {
            "sortColumns": [
                {"column": "age", "direction": "asc", "nullsFirst": False}
            ]
        }
        result = await sort_tool.execute(config, {"input": sample_data})

        assert "output" in result
        df = result["output"].collect()

        # Age should be sorted ascending: 25, 25, 30, 35, 40
        ages = df["age"].to_list()
        assert ages == [25, 25, 30, 35, 40]

    @pytest.mark.asyncio
    async def test_sort_single_column_descending(
        self, sort_tool: SortTool, sample_data: pl.LazyFrame
    ):
        """Test sorting by a single column in descending order."""
        config = {
            "sortColumns": [
                {"column": "age", "direction": "desc", "nullsFirst": False}
            ]
        }
        result = await sort_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()

        # Age should be sorted descending: 40, 35, 30, 25, 25
        ages = df["age"].to_list()
        assert ages == [40, 35, 30, 25, 25]

    @pytest.mark.asyncio
    async def test_sort_multiple_columns(self, sort_tool: SortTool, sample_data: pl.LazyFrame):
        """Test sorting by multiple columns."""
        config = {
            "sortColumns": [
                {"column": "age", "direction": "asc", "nullsFirst": False},
                {"column": "name", "direction": "desc", "nullsFirst": True}
            ]
        }
        result = await sort_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()

        # First sort by age ascending, then by name descending
        # Age 25: David (D > B), Bob
        # Age 30: Alice
        # Age 35: Charlie
        # Age 40: None (nulls last in name)
        ages = df["age"].to_list()
        names = df["name"].to_list()

        # First check age order
        assert ages == [25, 25, 30, 35, 40]
        # Within age=25, David should come before Bob (descending)
        assert names[:2] == ["David", "Bob"]

    @pytest.mark.asyncio
    async def test_sort_nulls_first(self, sort_tool: SortTool, sample_data: pl.LazyFrame):
        """Test sorting with nulls first."""
        config = {
            "sortColumns": [
                {"column": "name", "direction": "asc", "nullsFirst": True}
            ]
        }
        result = await sort_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()
        names = df["name"].to_list()

        # Null should be first
        assert names[0] is None
        # Remaining should be sorted alphabetically
        assert names[1:] == ["Alice", "Bob", "Charlie", "David"]

    @pytest.mark.asyncio
    async def test_sort_nulls_last(self, sort_tool: SortTool, sample_data: pl.LazyFrame):
        """Test sorting with nulls last."""
        config = {
            "sortColumns": [
                {"column": "name", "direction": "asc", "nullsFirst": False}
            ]
        }
        result = await sort_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()
        names = df["name"].to_list()

        # Remaining should be sorted alphabetically
        assert names[:-1] == ["Alice", "Bob", "Charlie", "David"]
        # Null should be last
        assert names[-1] is None

    @pytest.mark.asyncio
    async def test_sort_empty_columns(self, sort_tool: SortTool, sample_data: pl.LazyFrame):
        """Test that empty sort columns passes through data unchanged."""
        config = {"sortColumns": []}
        result = await sort_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()
        original_df = sample_data.collect()

        # Data should be unchanged
        assert df.shape == original_df.shape

    @pytest.mark.asyncio
    async def test_sort_preserves_all_columns(self, sort_tool: SortTool, sample_data: pl.LazyFrame):
        """Test that sorting preserves all columns in the output."""
        config = {
            "sortColumns": [
                {"column": "age", "direction": "asc", "nullsFirst": False}
            ]
        }
        result = await sort_tool.execute(config, {"input": sample_data})

        df = result["output"].collect()

        # All original columns should be preserved
        assert set(df.columns) == {"name", "age", "city", "salary"}


class TestSortToolOutputSchema:
    """Tests for SortTool.get_output_schema()."""

    @pytest.mark.asyncio
    async def test_output_schema_passthrough(self, sort_tool: SortTool):
        """Test that output schema is same as input schema."""
        input_schema = {
            "input": {
                "columns": [
                    {"name": "name", "dtype": "String", "nullable": True},
                    {"name": "age", "dtype": "Int64", "nullable": False},
                ]
            }
        }
        config = {
            "sortColumns": [
                {"column": "age", "direction": "asc", "nullsFirst": False}
            ]
        }

        result = await sort_tool.get_output_schema(config, input_schema)

        assert "output" in result
        assert result["output"] == input_schema["input"]

    @pytest.mark.asyncio
    async def test_output_schema_no_input(self, sort_tool: SortTool):
        """Test that output schema raises error when missing input schema."""
        from app.utils.errors import ToolError

        config = {"sortColumns": []}

        with pytest.raises(ToolError, match="requires input schema"):
            await sort_tool.get_output_schema(config, {})


class TestSortToolValidation:
    """Tests for SortTool.validate_config()."""

    @pytest.mark.asyncio
    async def test_valid_config(self, sort_tool: SortTool):
        """Test validation of valid configuration."""
        config = {
            "sortColumns": [
                {"column": "age", "direction": "asc", "nullsFirst": False}
            ]
        }
        errors = await sort_tool.validate_config(config)
        assert errors == []

    @pytest.mark.asyncio
    async def test_valid_empty_sort_columns(self, sort_tool: SortTool):
        """Test validation allows empty sort columns."""
        config = {"sortColumns": []}
        errors = await sort_tool.validate_config(config)
        assert errors == []

    @pytest.mark.asyncio
    async def test_invalid_missing_column_name(self, sort_tool: SortTool):
        """Test validation catches missing column name."""
        config = {
            "sortColumns": [
                {"column": "", "direction": "asc", "nullsFirst": False}
            ]
        }
        errors = await sort_tool.validate_config(config)
        assert len(errors) == 1
        assert "missing" in errors[0].lower() and "column" in errors[0].lower()

    @pytest.mark.asyncio
    async def test_invalid_direction(self, sort_tool: SortTool):
        """Test validation catches invalid direction."""
        config = {
            "sortColumns": [
                {"column": "age", "direction": "invalid", "nullsFirst": False}
            ]
        }
        errors = await sort_tool.validate_config(config)
        assert len(errors) == 1
        assert "direction" in errors[0].lower()


class TestSortToolToPythonCode:
    """Tests for SortTool.to_python_code()."""

    @pytest.mark.asyncio
    async def test_python_code_single_column(self, sort_tool: SortTool):
        """Test Python code generation for single column sort."""
        config = {
            "sortColumns": [
                {"column": "age", "direction": "asc", "nullsFirst": False}
            ]
        }
        code_lines, output_vars = sort_tool.to_python_code(
            tool_id="sort_1",
            config=config,
            input_vars={"input": "df_input"},
        )

        code = "\n".join(code_lines)
        assert "df_sort_1 = df_input.sort" in code
        assert '"age"' in code
        assert "descending=[False]" in code
        assert "output" in output_vars
        assert output_vars["output"] == "df_sort_1"

    @pytest.mark.asyncio
    async def test_python_code_multiple_columns(self, sort_tool: SortTool):
        """Test Python code generation for multiple column sort."""
        config = {
            "sortColumns": [
                {"column": "age", "direction": "asc", "nullsFirst": False},
                {"column": "name", "direction": "desc", "nullsFirst": True}
            ]
        }
        code_lines, output_vars = sort_tool.to_python_code(
            tool_id="sort_2",
            config=config,
            input_vars={"input": "df_input"},
        )

        code = "\n".join(code_lines)
        assert "df_sort_2 = df_input.sort" in code
        assert '"age"' in code
        assert '"name"' in code
        assert "output" in output_vars

    @pytest.mark.asyncio
    async def test_python_code_empty_columns(self, sort_tool: SortTool):
        """Test Python code generation for empty sort columns."""
        config = {"sortColumns": []}
        code_lines, output_vars = sort_tool.to_python_code(
            tool_id="sort_3",
            config=config,
            input_vars={"input": "df_input"},
        )

        code = "\n".join(code_lines)
        # Should just pass through
        assert "df_sort_3 = df_input" in code
        assert "output" in output_vars
