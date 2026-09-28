"""Tests for Summarize tool"""

import polars as pl
import pytest

from app.domain.models.common import ColumnSchema, DataSchema
from app.domain.tools.implementations.summarize import SummarizeTool


@pytest.fixture
def sample_df() -> pl.LazyFrame:
    """Create sample data for testing"""
    return pl.LazyFrame(
        {
            "category": ["A", "A", "B", "B", "B"],
            "subcategory": ["x", "y", "x", "x", "y"],
            "amount": [100, 200, 150, 250, 300],
            "count": [1, 2, 3, 4, 5],
            "name": ["alice", "bob", "carol", "dave", "eve"],
        }
    )


@pytest.fixture
def sample_schema() -> DataSchema:
    """Create sample schema for testing"""
    return DataSchema(
        columns=[
            ColumnSchema(name="category", dtype="String", nullable=True),
            ColumnSchema(name="subcategory", dtype="String", nullable=True),
            ColumnSchema(name="amount", dtype="Int64", nullable=True),
            ColumnSchema(name="count", dtype="Int64", nullable=True),
            ColumnSchema(name="name", dtype="String", nullable=True),
        ],
        row_count=5,
        file_size_bytes=None,
    )


class TestSummarizeToolExecute:
    """Tests for SummarizeTool.execute()"""

    @pytest.mark.asyncio
    async def test_sum_aggregation(self, sample_df: pl.LazyFrame):
        """Test basic sum aggregation"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [
                {"column": "amount", "operation": "Sum", "outputName": "total_amount"}
            ],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        assert "category" in df.columns
        assert "total_amount" in df.columns
        assert len(df) == 2  # Two categories: A and B

        # Check values
        a_row = df.filter(pl.col("category") == "A")
        b_row = df.filter(pl.col("category") == "B")
        assert a_row["total_amount"][0] == 300  # 100 + 200
        assert b_row["total_amount"][0] == 700  # 150 + 250 + 300

    @pytest.mark.asyncio
    async def test_multiple_aggregations(self, sample_df: pl.LazyFrame):
        """Test multiple aggregations on same group by"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [
                {"column": "amount", "operation": "Sum", "outputName": "total"},
                {"column": "amount", "operation": "Mean", "outputName": "average"},
                {"column": "count", "operation": "Count", "outputName": "num_rows"},
            ],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        assert len(df.columns) == 4  # category + 3 aggregations
        assert "total" in df.columns
        assert "average" in df.columns
        assert "num_rows" in df.columns

    @pytest.mark.asyncio
    async def test_global_aggregation(self, sample_df: pl.LazyFrame):
        """Test aggregation without group by (global)"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [],
            "aggregations": [{"column": "amount", "operation": "Sum", "outputName": "total"}],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        assert len(df) == 1  # Single row for global aggregation
        assert df["total"][0] == 1000  # 100 + 200 + 150 + 250 + 300

    @pytest.mark.asyncio
    async def test_multiple_group_by_columns(self, sample_df: pl.LazyFrame):
        """Test grouping by multiple columns"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category", "subcategory"],
            "aggregations": [{"column": "amount", "operation": "Sum", "outputName": "total"}],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        assert len(df) == 4  # A-x, A-y, B-x, B-y
        assert "category" in df.columns
        assert "subcategory" in df.columns

    @pytest.mark.asyncio
    async def test_count_distinct(self, sample_df: pl.LazyFrame):
        """Test count distinct aggregation"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [
                {"column": "subcategory", "operation": "CountDistinct", "outputName": "unique_sub"}
            ],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        # Both categories have 2 unique subcategories
        assert all(df["unique_sub"] == 2)

    @pytest.mark.asyncio
    async def test_first_last_aggregation(self, sample_df: pl.LazyFrame):
        """Test first and last aggregations"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [
                {"column": "name", "operation": "First", "outputName": "first_name"},
                {"column": "name", "operation": "Last", "outputName": "last_name"},
            ],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        assert "first_name" in df.columns
        assert "last_name" in df.columns

    @pytest.mark.asyncio
    async def test_group_by_only_distinct(self, sample_df: pl.LazyFrame):
        """Test group by without aggregations returns distinct values"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        # Should only have the group by column
        assert df.columns == ["category"]
        # Should have unique values
        assert df.height == df.select("category").n_unique()

    @pytest.mark.asyncio
    async def test_group_by_object_format_with_id(self, sample_df: pl.LazyFrame):
        """Test group by columns in new object format with _id"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [
                {"_id": "action-123", "column": "category"},
            ],
            "aggregations": [
                {
                    "_id": "action-456",
                    "column": "amount",
                    "operation": "Sum",
                    "outputName": "total_amount",
                }
            ],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        assert "category" in df.columns
        assert "total_amount" in df.columns
        assert len(df) == 2  # Two categories: A and B

    @pytest.mark.asyncio
    async def test_group_by_and_aggregate_same_column(self, sample_df: pl.LazyFrame):
        """Test grouping by a column AND aggregating on the same column"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [
                {"_id": "action-1", "column": "category"},
            ],
            "aggregations": [
                {
                    "_id": "action-2",
                    "column": "category",
                    "operation": "Count",
                    "outputName": "Count_category",
                },
                {
                    "_id": "action-3",
                    "column": "amount",
                    "operation": "Sum",
                    "outputName": "Sum_amount",
                },
            ],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        assert "category" in df.columns
        assert "Count_category" in df.columns
        assert "Sum_amount" in df.columns
        assert len(df) == 2  # Two categories: A and B

        # Check values - category A has 2 rows, category B has 3 rows
        a_row = df.filter(pl.col("category") == "A")
        b_row = df.filter(pl.col("category") == "B")
        assert a_row["Count_category"][0] == 2
        assert b_row["Count_category"][0] == 3
        assert a_row["Sum_amount"][0] == 300  # 100 + 200
        assert b_row["Sum_amount"][0] == 700  # 150 + 250 + 300

    @pytest.mark.asyncio
    async def test_mixed_format_group_by_columns(self, sample_df: pl.LazyFrame):
        """Test mixing legacy string format and new object format for groupByColumns"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [
                "category",  # Legacy string format
                {"_id": "action-1", "column": "subcategory"},  # New object format
            ],
            "aggregations": [
                {"column": "amount", "operation": "Sum", "outputName": "total_amount"}
            ],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        assert "category" in df.columns
        assert "subcategory" in df.columns
        assert "total_amount" in df.columns

    @pytest.mark.asyncio
    async def test_default_output_name(self, sample_df: pl.LazyFrame):
        """Test default output name when not specified"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [{"column": "amount", "operation": "Sum", "outputName": ""}],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()

        # Default name should be column_operation
        assert "amount_Sum" in df.columns


class TestSummarizeToolSchema:
    """Tests for SummarizeTool.get_output_schema()"""

    @pytest.mark.asyncio
    async def test_schema_with_group_by(self, sample_schema: DataSchema):
        """Test output schema includes group by and aggregation columns"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [{"column": "amount", "operation": "Sum", "outputName": "total"}],
        }
        result = await tool.get_output_schema(config, {"input": sample_schema})
        output_schema = result["output"]

        assert len(output_schema.columns) == 2
        assert output_schema.columns[0].name == "category"
        assert output_schema.columns[1].name == "total"
        # Sum on Int64 should preserve Int64
        assert output_schema.columns[1].dtype == "Int64"

    @pytest.mark.asyncio
    async def test_schema_mean_returns_float(self, sample_schema: DataSchema):
        """Test mean aggregation returns Float64"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [],
            "aggregations": [{"column": "amount", "operation": "Mean", "outputName": "avg"}],
        }
        result = await tool.get_output_schema(config, {"input": sample_schema})
        output_schema = result["output"]

        assert output_schema.columns[0].dtype == "Float64"

    @pytest.mark.asyncio
    async def test_schema_count_returns_uint32(self, sample_schema: DataSchema):
        """Test count aggregation returns UInt32"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [],
            "aggregations": [{"column": "name", "operation": "Count", "outputName": "cnt"}],
        }
        result = await tool.get_output_schema(config, {"input": sample_schema})
        output_schema = result["output"]

        assert output_schema.columns[0].dtype == "UInt32"


class TestSummarizeToolValidation:
    """Tests for SummarizeTool.validate_config()"""

    @pytest.mark.asyncio
    async def test_valid_config(self):
        """Test valid configuration passes validation"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [{"column": "amount", "operation": "Sum", "outputName": "total"}],
        }
        errors = await tool.validate_config(config)
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_empty_aggregations_with_group_by_valid(self):
        """Test empty aggregations with group by columns is valid (distinct values)"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [],
        }
        errors = await tool.validate_config(config)
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_empty_aggregations_no_group_by_invalid(self):
        """Test empty aggregations without group by columns is invalid"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [],
            "aggregations": [],
        }
        errors = await tool.validate_config(config)
        assert len(errors) > 0
        assert "required" in errors[0].lower()

    @pytest.mark.asyncio
    async def test_missing_column_invalid(self):
        """Test aggregation without column is invalid"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [],
            "aggregations": [{"column": "", "operation": "Sum", "outputName": "total"}],
        }
        errors = await tool.validate_config(config)
        assert len(errors) > 0
        assert "column" in errors[0].lower()

    @pytest.mark.asyncio
    async def test_invalid_operation(self):
        """Test invalid operation is rejected"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [],
            "aggregations": [{"column": "amount", "operation": "InvalidOp", "outputName": "total"}],
        }
        errors = await tool.validate_config(config)
        assert len(errors) > 0
        assert "InvalidOp" in errors[0]

    @pytest.mark.asyncio
    async def test_duplicate_output_names_invalid(self):
        """Test duplicate output column names are invalid"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [],
            "aggregations": [
                {"column": "amount", "operation": "Sum", "outputName": "total"},
                {"column": "count", "operation": "Sum", "outputName": "total"},
            ],
        }
        errors = await tool.validate_config(config)
        assert len(errors) > 0
        assert "duplicate" in errors[0].lower()


class TestSummarizeCodeGeneration:
    """Tests for SummarizeTool.to_python_code()"""

    def test_code_gen_with_group_by(self):
        """Test code generation with group by"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [{"column": "amount", "operation": "Sum", "outputName": "total"}],
        }
        lines, output_vars = tool.to_python_code("summarize1", config, {"input": "df_input"})

        code = "\n".join(lines)
        assert "group_by" in code
        assert '"category"' in code
        assert ".sum()" in code
        assert '.alias("total")' in code
        assert output_vars["output"] == "df_summarize1"

    def test_code_gen_global_aggregation(self):
        """Test code generation without group by"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": [],
            "aggregations": [{"column": "amount", "operation": "Mean", "outputName": "avg_amount"}],
        }
        lines, output_vars = tool.to_python_code("summarize1", config, {"input": "df_input"})

        code = "\n".join(lines)
        assert ".select([" in code  # Not group_by for global
        assert ".mean()" in code
        assert "group_by" not in code

    def test_code_gen_multiple_aggregations(self):
        """Test code generation with multiple aggregations"""
        tool = SummarizeTool()
        config = {
            "groupByColumns": ["category"],
            "aggregations": [
                {"column": "amount", "operation": "Sum", "outputName": "total"},
                {"column": "amount", "operation": "Mean", "outputName": "average"},
                {"column": "count", "operation": "Count", "outputName": "num_rows"},
            ],
        }
        lines, output_vars = tool.to_python_code("summarize1", config, {"input": "df_input"})

        code = "\n".join(lines)
        assert ".sum()" in code
        assert ".mean()" in code
        assert ".count()" in code
