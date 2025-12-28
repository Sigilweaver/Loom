"""Tests for Join tool."""

import polars as pl
import pytest

from app.api.models.common import ColumnSchema, DataSchema
from app.domain.tools.implementations.join import JoinTool


@pytest.fixture
def left_dataframe():
    """Create a sample left dataframe for testing."""
    return pl.LazyFrame({
        "id": [1, 2, 3, 4],
        "name": ["Alice", "Bob", "Charlie", "Diana"],
        "department": ["Engineering", "Sales", "Engineering", "HR"],
    })


@pytest.fixture
def right_dataframe():
    """Create a sample right dataframe for testing."""
    return pl.LazyFrame({
        "id": [2, 3, 5, 6],
        "salary": [50000, 60000, 55000, 45000],
        "location": ["NYC", "LA", "Chicago", "Boston"],
    })


@pytest.fixture
def left_schema():
    """Create schema for left dataframe."""
    return DataSchema(columns=[
        ColumnSchema(name="id", dtype="Int64", nullable=False),
        ColumnSchema(name="name", dtype="String", nullable=False),
        ColumnSchema(name="department", dtype="String", nullable=False),
    ])


@pytest.fixture
def right_schema():
    """Create schema for right dataframe."""
    return DataSchema(columns=[
        ColumnSchema(name="id", dtype="Int64", nullable=False),
        ColumnSchema(name="salary", dtype="Int64", nullable=False),
        ColumnSchema(name="location", dtype="String", nullable=False),
    ])


class TestJoinToolExecute:
    """Tests for JoinTool.execute()."""

    @pytest.mark.asyncio
    async def test_join_basic_inner(self, left_dataframe, right_dataframe):
        """Test basic inner join on id column."""
        tool = JoinTool()
        config = {
            "joinType": "inner",
            "leftKeys": ["id"],
            "rightKeys": ["id"],
        }
        inputs = {
            "input-left": left_dataframe,
            "input-right": right_dataframe,
        }

        result = await tool.execute(config, inputs)

        # Check we have all three outputs
        assert "output-left" in result
        assert "output-match" in result
        assert "output-right" in result

        # Matched rows (ids 2 and 3)
        matched = result["output-match"].collect()
        assert len(matched) == 2
        assert sorted(matched["id"].to_list()) == [2, 3]
        # Matched should have columns from both sides
        assert "name" in matched.columns
        assert "salary" in matched.columns

        # Unmatched left (ids 1 and 4)
        unmatched_left = result["output-left"].collect()
        assert len(unmatched_left) == 2
        assert sorted(unmatched_left["id"].to_list()) == [1, 4]

        # Unmatched right (ids 5 and 6)
        unmatched_right = result["output-right"].collect()
        assert len(unmatched_right) == 2
        assert sorted(unmatched_right["id"].to_list()) == [5, 6]

    @pytest.mark.asyncio
    async def test_join_all_match(self):
        """Test join where all rows match."""
        tool = JoinTool()
        left = pl.LazyFrame({"id": [1, 2], "val": ["a", "b"]})
        right = pl.LazyFrame({"id": [1, 2], "score": [10, 20]})

        config = {"leftKeys": ["id"], "rightKeys": ["id"]}
        result = await tool.execute(config, {"input-left": left, "input-right": right})

        matched = result["output-match"].collect()
        assert len(matched) == 2

        unmatched_left = result["output-left"].collect()
        assert len(unmatched_left) == 0

        unmatched_right = result["output-right"].collect()
        assert len(unmatched_right) == 0

    @pytest.mark.asyncio
    async def test_join_no_match(self):
        """Test join where no rows match."""
        tool = JoinTool()
        left = pl.LazyFrame({"id": [1, 2], "val": ["a", "b"]})
        right = pl.LazyFrame({"id": [3, 4], "score": [10, 20]})

        config = {"leftKeys": ["id"], "rightKeys": ["id"]}
        result = await tool.execute(config, {"input-left": left, "input-right": right})

        matched = result["output-match"].collect()
        assert len(matched) == 0

        unmatched_left = result["output-left"].collect()
        assert len(unmatched_left) == 2

        unmatched_right = result["output-right"].collect()
        assert len(unmatched_right) == 2

    @pytest.mark.asyncio
    async def test_join_multi_key(self):
        """Test join on multiple key columns."""
        tool = JoinTool()
        left = pl.LazyFrame({
            "dept": ["A", "A", "B", "B"],
            "year": [2022, 2023, 2022, 2023],
            "budget": [100, 110, 200, 210],
        })
        right = pl.LazyFrame({
            "department": ["A", "B", "C"],
            "fiscal_year": [2023, 2022, 2023],
            "headcount": [10, 20, 5],
        })

        config = {
            "leftKeys": ["dept", "year"],
            "rightKeys": ["department", "fiscal_year"],
        }
        result = await tool.execute(config, {"input-left": left, "input-right": right})

        matched = result["output-match"].collect()
        assert len(matched) == 2  # (A, 2023) and (B, 2022)

    @pytest.mark.asyncio
    async def test_join_column_name_conflict_with_suffix(self):
        """Test that conflicting column names get suffix."""
        tool = JoinTool()
        left = pl.LazyFrame({"id": [1, 2], "value": [100, 200]})
        right = pl.LazyFrame({"id": [1, 2], "value": [10, 20]})

        config = {
            "leftKeys": ["id"],
            "rightKeys": ["id"],
            "rightSuffix": "_r",
        }
        result = await tool.execute(config, {"input-left": left, "input-right": right})

        matched = result["output-match"].collect()
        assert "value" in matched.columns
        assert "value_r" in matched.columns
        # Left value should be original
        assert sorted(matched["value"].to_list()) == [100, 200]
        # Right value should be suffixed
        assert sorted(matched["value_r"].to_list()) == [10, 20]

    @pytest.mark.asyncio
    async def test_join_empty_keys_cross_join(self, left_dataframe, right_dataframe):
        """Test that empty keys performs a cross join (Cartesian product)."""
        tool = JoinTool()
        config = {"leftKeys": [], "rightKeys": []}
        result = await tool.execute(
            config,
            {"input-left": left_dataframe, "input-right": right_dataframe},
        )

        # Cross join produces Cartesian product in matched output
        matched = result["output-match"].collect()
        # 4 left rows x 4 right rows = 16 matched rows
        assert len(matched) == 16
        # Should have columns from both sides
        assert "name" in matched.columns
        assert "salary" in matched.columns

        # Unmatched outputs should be empty for cross join
        unmatched_left = result["output-left"].collect()
        assert len(unmatched_left) == 0

        unmatched_right = result["output-right"].collect()
        assert len(unmatched_right) == 0

    @pytest.mark.asyncio
    async def test_join_missing_left_input(self, right_dataframe):
        """Test join with missing left input."""
        tool = JoinTool()
        config = {"leftKeys": ["id"], "rightKeys": ["id"]}
        result = await tool.execute(config, {"input-right": right_dataframe})

        # Left output empty, right passes through
        assert result["output-left"].collect().is_empty()
        assert result["output-match"].collect().is_empty()
        assert len(result["output-right"].collect()) == 4

    @pytest.mark.asyncio
    async def test_join_missing_right_input(self, left_dataframe):
        """Test join with missing right input."""
        tool = JoinTool()
        config = {"leftKeys": ["id"], "rightKeys": ["id"]}
        result = await tool.execute(config, {"input-left": left_dataframe})

        # Right output empty, left passes through
        assert len(result["output-left"].collect()) == 4
        assert result["output-match"].collect().is_empty()
        assert result["output-right"].collect().is_empty()

    @pytest.mark.asyncio
    async def test_join_missing_both_inputs(self):
        """Test join with no inputs."""
        tool = JoinTool()
        config = {"leftKeys": ["id"], "rightKeys": ["id"]}
        result = await tool.execute(config, {})

        assert result["output-left"].collect().is_empty()
        assert result["output-match"].collect().is_empty()
        assert result["output-right"].collect().is_empty()


class TestJoinToolOutputSchema:
    """Tests for JoinTool.get_output_schema()."""

    @pytest.mark.asyncio
    async def test_schema_basic_join(self, left_schema, right_schema):
        """Test output schema for basic join."""
        tool = JoinTool()
        config = {"leftKeys": ["id"], "rightKeys": ["id"]}

        result = await tool.get_output_schema(
            config,
            {"input-left": left_schema, "input-right": right_schema},
        )

        # Left unmatched has left schema
        assert result["output-left"] == left_schema

        # Right unmatched has right schema
        assert result["output-right"] == right_schema

        # Matched has combined schema (left + right non-key columns)
        matched_cols = {col.name for col in result["output-match"].columns}
        assert "id" in matched_cols
        assert "name" in matched_cols
        assert "department" in matched_cols
        assert "salary" in matched_cols
        assert "location" in matched_cols

    @pytest.mark.asyncio
    async def test_schema_with_conflict_suffix(self):
        """Test schema handles column name conflicts."""
        tool = JoinTool()
        left_schema = DataSchema(columns=[
            ColumnSchema(name="id", dtype="Int64", nullable=False),
            ColumnSchema(name="value", dtype="Int64", nullable=False),
        ])
        right_schema = DataSchema(columns=[
            ColumnSchema(name="id", dtype="Int64", nullable=False),
            ColumnSchema(name="value", dtype="Int64", nullable=False),
        ])

        config = {
            "leftKeys": ["id"],
            "rightKeys": ["id"],
            "rightSuffix": "_right",
        }
        result = await tool.get_output_schema(
            config,
            {"input-left": left_schema, "input-right": right_schema},
        )

        matched_col_names = [col.name for col in result["output-match"].columns]
        assert "value" in matched_col_names
        assert "value_right" in matched_col_names

    @pytest.mark.asyncio
    async def test_schema_no_keys_cross_join(self, left_schema, right_schema):
        """Test schema with no keys specified produces cross join schema."""
        tool = JoinTool()
        config = {"leftKeys": [], "rightKeys": []}

        result = await tool.get_output_schema(
            config,
            {"input-left": left_schema, "input-right": right_schema},
        )

        # Cross join: matched output has all columns from both sides
        matched_col_names = [col.name for col in result["output-match"].columns]
        assert "id" in matched_col_names
        assert "name" in matched_col_names
        assert "department" in matched_col_names
        assert "salary" in matched_col_names
        assert "location" in matched_col_names
        # Right id gets suffix since it conflicts with left id
        assert "id_right" in matched_col_names
        # Total: 3 left + 3 right = 6 columns
        assert len(matched_col_names) == 6

        # Unmatched outputs should be empty for cross join
        assert len(result["output-left"].columns) == 0
        assert len(result["output-right"].columns) == 0


class TestJoinToolValidation:
    """Tests for JoinTool.validate_config()."""

    @pytest.mark.asyncio
    async def test_valid_config(self):
        """Test valid configuration."""
        tool = JoinTool()
        config = {
            "joinType": "inner",
            "leftKeys": ["id"],
            "rightKeys": ["id"],
        }
        errors = await tool.validate_config(config)
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_key_length_mismatch(self):
        """Test error when key lists have different lengths."""
        tool = JoinTool()
        config = {
            "leftKeys": ["id", "name"],
            "rightKeys": ["id"],
        }
        errors = await tool.validate_config(config)
        assert len(errors) == 1
        assert "same number" in errors[0]

    @pytest.mark.asyncio
    async def test_cross_join_type_is_valid(self):
        """Test that cross join type is valid."""
        tool = JoinTool()
        config = {
            "joinType": "cross",
            "leftKeys": [],
            "rightKeys": [],
        }
        errors = await tool.validate_config(config)
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_invalid_join_type(self):
        """Test error for invalid join type."""
        tool = JoinTool()
        config = {
            "joinType": "invalid_type",
            "leftKeys": ["id"],
            "rightKeys": ["id"],
        }
        errors = await tool.validate_config(config)
        assert len(errors) == 1
        assert "Invalid join type" in errors[0]

    @pytest.mark.asyncio
    async def test_missing_key_column_in_schema(self, left_schema):
        """Test error when key column doesn't exist in schema."""
        tool = JoinTool()
        config = {
            "leftKeys": ["nonexistent"],
            "rightKeys": ["id"],
        }
        errors = await tool.validate_config(config, {"input-left": left_schema})
        assert len(errors) == 1
        assert "nonexistent" in errors[0]


class TestJoinCodeGeneration:
    """Tests for JoinTool.to_python_code()."""

    def test_code_gen_basic_join(self):
        """Test code generation for basic join."""
        tool = JoinTool()
        config = {
            "leftKeys": ["id"],
            "rightKeys": ["id"],
            "rightSuffix": "_right",
        }
        lines, output_vars = tool.to_python_code(
            "join1",
            config,
            {"input-left": "df_left", "input-right": "df_right"},
        )

        code = "\n".join(lines)

        # Check we generate inner join
        assert 'how="inner"' in code
        assert 'left_on=' in code
        assert 'right_on=' in code

        # Check anti-joins
        assert 'how="anti"' in code

        # Check output variables
        assert "output-left" in output_vars
        assert "output-match" in output_vars
        assert "output-right" in output_vars

    def test_code_gen_no_inputs(self):
        """Test code generation with no inputs."""
        tool = JoinTool()
        config = {"leftKeys": ["id"], "rightKeys": ["id"]}
        lines, output_vars = tool.to_python_code("join1", config, {})

        code = "\n".join(lines)
        assert "pl.LazyFrame([])" in code
        assert len(output_vars) == 3

    def test_code_gen_left_input_only(self):
        """Test code generation with only left input."""
        tool = JoinTool()
        config = {"leftKeys": ["id"], "rightKeys": ["id"]}
        lines, output_vars = tool.to_python_code(
            "join1", config, {"input-left": "df_left"}
        )

        code = "\n".join(lines)
        # Left passes through, others empty
        assert "df_left" in code
        assert "pl.LazyFrame([])" in code

    def test_code_gen_cross_join(self):
        """Test code generation for cross join (no keys specified)."""
        tool = JoinTool()
        config = {"leftKeys": [], "rightKeys": [], "rightSuffix": "_right"}
        lines, output_vars = tool.to_python_code(
            "join1",
            config,
            {"input-left": "df_left", "input-right": "df_right"},
        )

        code = "\n".join(lines)

        # Check we generate cross join
        assert 'how="cross"' in code
        assert "df_left" in code
        assert "df_right" in code

        # Unmatched outputs should be empty LazyFrames
        assert "pl.LazyFrame([])" in code

        # Check output variables
        assert len(output_vars) == 3
