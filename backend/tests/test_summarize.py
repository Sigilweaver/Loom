"""Tests for Summarize tool"""

import pytest
import polars as pl

from app.api.models.common import DataSchema, ColumnSchema
from app.domain.tools.implementations.summarize import SummarizeTool


@pytest.fixture
def sample_df() -> pl.LazyFrame:
    """Create sample data for testing"""
    return pl.LazyFrame({
        "category": ["A", "A", "B", "B", "B"],
        "subcategory": ["x", "y", "x", "x", "y"],
        "amount": [100, 200, 150, 250, 300],
        "count": [1, 2, 3, 4, 5],
        "name": ["alice", "bob", "carol", "dave", "eve"],
    })


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
            "groupByFields": ["category"],
            "aggregations": [
                {"field": "amount", "operation": "Sum", "outputName": "total_amount"}
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
            "groupByFields": ["category"],
            "aggregations": [
                {"field": "amount", "operation": "Sum", "outputName": "total"},
                {"field": "amount", "operation": "Mean", "outputName": "average"},
                {"field": "count", "operation": "Count", "outputName": "num_rows"},
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
            "groupByFields": [],
            "aggregations": [
                {"field": "amount", "operation": "Sum", "outputName": "total"}
            ],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()
        
        assert len(df) == 1  # Single row for global aggregation
        assert df["total"][0] == 1000  # 100 + 200 + 150 + 250 + 300

    @pytest.mark.asyncio
    async def test_multiple_group_by_fields(self, sample_df: pl.LazyFrame):
        """Test grouping by multiple fields"""
        tool = SummarizeTool()
        config = {
            "groupByFields": ["category", "subcategory"],
            "aggregations": [
                {"field": "amount", "operation": "Sum", "outputName": "total"}
            ],
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
            "groupByFields": ["category"],
            "aggregations": [
                {"field": "subcategory", "operation": "CountDistinct", "outputName": "unique_sub"}
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
            "groupByFields": ["category"],
            "aggregations": [
                {"field": "name", "operation": "First", "outputName": "first_name"},
                {"field": "name", "operation": "Last", "outputName": "last_name"},
            ],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()
        
        assert "first_name" in df.columns
        assert "last_name" in df.columns

    @pytest.mark.asyncio
    async def test_default_output_name(self, sample_df: pl.LazyFrame):
        """Test default output name when not specified"""
        tool = SummarizeTool()
        config = {
            "groupByFields": ["category"],
            "aggregations": [
                {"field": "amount", "operation": "Sum", "outputName": ""}
            ],
        }
        result = await tool.execute(config, {"input": sample_df})
        df = result["output"].collect()
        
        # Default name should be field_operation
        assert "amount_Sum" in df.columns


class TestSummarizeToolSchema:
    """Tests for SummarizeTool.get_output_schema()"""

    @pytest.mark.asyncio
    async def test_schema_with_group_by(self, sample_schema: DataSchema):
        """Test output schema includes group by and aggregation columns"""
        tool = SummarizeTool()
        config = {
            "groupByFields": ["category"],
            "aggregations": [
                {"field": "amount", "operation": "Sum", "outputName": "total"}
            ],
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
            "groupByFields": [],
            "aggregations": [
                {"field": "amount", "operation": "Mean", "outputName": "avg"}
            ],
        }
        result = await tool.get_output_schema(config, {"input": sample_schema})
        output_schema = result["output"]
        
        assert output_schema.columns[0].dtype == "Float64"

    @pytest.mark.asyncio
    async def test_schema_count_returns_uint32(self, sample_schema: DataSchema):
        """Test count aggregation returns UInt32"""
        tool = SummarizeTool()
        config = {
            "groupByFields": [],
            "aggregations": [
                {"field": "name", "operation": "Count", "outputName": "cnt"}
            ],
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
            "groupByFields": ["category"],
            "aggregations": [
                {"field": "amount", "operation": "Sum", "outputName": "total"}
            ],
        }
        errors = await tool.validate_config(config)
        assert len(errors) == 0

    @pytest.mark.asyncio
    async def test_empty_aggregations_invalid(self):
        """Test empty aggregations list is invalid"""
        tool = SummarizeTool()
        config = {
            "groupByFields": ["category"],
            "aggregations": [],
        }
        errors = await tool.validate_config(config)
        assert len(errors) > 0
        assert "aggregation is required" in errors[0].lower()

    @pytest.mark.asyncio
    async def test_missing_field_invalid(self):
        """Test aggregation without field is invalid"""
        tool = SummarizeTool()
        config = {
            "groupByFields": [],
            "aggregations": [
                {"field": "", "operation": "Sum", "outputName": "total"}
            ],
        }
        errors = await tool.validate_config(config)
        assert len(errors) > 0
        assert "field" in errors[0].lower()

    @pytest.mark.asyncio
    async def test_invalid_operation(self):
        """Test invalid operation is rejected"""
        tool = SummarizeTool()
        config = {
            "groupByFields": [],
            "aggregations": [
                {"field": "amount", "operation": "InvalidOp", "outputName": "total"}
            ],
        }
        errors = await tool.validate_config(config)
        assert len(errors) > 0
        assert "InvalidOp" in errors[0]

    @pytest.mark.asyncio
    async def test_duplicate_output_names_invalid(self):
        """Test duplicate output column names are invalid"""
        tool = SummarizeTool()
        config = {
            "groupByFields": [],
            "aggregations": [
                {"field": "amount", "operation": "Sum", "outputName": "total"},
                {"field": "count", "operation": "Sum", "outputName": "total"},
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
            "groupByFields": ["category"],
            "aggregations": [
                {"field": "amount", "operation": "Sum", "outputName": "total"}
            ],
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
            "groupByFields": [],
            "aggregations": [
                {"field": "amount", "operation": "Mean", "outputName": "avg_amount"}
            ],
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
            "groupByFields": ["category"],
            "aggregations": [
                {"field": "amount", "operation": "Sum", "outputName": "total"},
                {"field": "amount", "operation": "Mean", "outputName": "average"},
                {"field": "count", "operation": "Count", "outputName": "num_rows"},
            ],
        }
        lines, output_vars = tool.to_python_code("summarize1", config, {"input": "df_input"})
        
        code = "\n".join(lines)
        assert ".sum()" in code
        assert ".mean()" in code
        assert ".count()" in code
