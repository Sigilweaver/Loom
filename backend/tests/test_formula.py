"""Tests for Formula tool"""

import pytest
import polars as pl
from app.domain.tools.implementations.formula import FormulaTool
from app.api.models.common import DataSchema, ColumnSchema, PolarsDataType


@pytest.mark.asyncio
async def test_formula_arithmetic():
    """Test arithmetic expressions"""
    tool = FormulaTool()
    
    df = pl.LazyFrame({
        "price": [10, 20, 30],
        "quantity": [2, 3, 4],
    })
    
    config = {
        "column_name": "total",
        "expression": "pl.col('price') * pl.col('quantity')",
    }
    
    result = await tool.execute(config, {"input": df})
    output = result["output"].collect()
    
    assert "total" in output.columns
    assert output["total"].to_list() == [20, 60, 120]


@pytest.mark.asyncio
async def test_formula_replace_column():
    """Test replacing an existing column with a calculated value"""
    tool = FormulaTool()
    
    df = pl.LazyFrame({
        "price": [10.0, 20.0, 30.0],
        "quantity": [2, 3, 4],
    })
    
    config = {
        "column_name": "price",
        "expression": "pl.col('price') * 1.1",
    }
    
    result = await tool.execute(config, {"input": df})
    output = result["output"].collect()
    
    # Column should still exist
    assert "price" in output.columns
    assert "quantity" in output.columns
    # Column count should be unchanged
    assert len(output.columns) == 2
    # Values should be updated
    assert output["price"].to_list() == [11.0, 22.0, 33.0]


@pytest.mark.asyncio
async def test_formula_replace_column_maintains_order():
    """Test that replacing a column maintains the original column order"""
    tool = FormulaTool()
    
    df = pl.LazyFrame({
        "a": [1, 2, 3],
        "b": [4, 5, 6],
        "c": [7, 8, 9],
    })
    
    config = {
        "column_name": "b",
        "expression": "pl.col('b') * 10",
    }
    
    result = await tool.execute(config, {"input": df})
    output = result["output"].collect()
    
    # Column order should be preserved
    assert output.columns == ["a", "b", "c"]
    # Values should be updated
    assert output["b"].to_list() == [40, 50, 60]


@pytest.mark.asyncio
async def test_formula_replace_column_schema():
    """Test that schema correctly reflects replaced column"""
    tool = FormulaTool()
    
    input_schema = DataSchema(
        columns=[
            ColumnSchema(name="price", dtype=PolarsDataType.FLOAT64, nullable=True),
            ColumnSchema(name="quantity", dtype=PolarsDataType.INT64, nullable=True),
            ColumnSchema(name="name", dtype=PolarsDataType.STRING, nullable=True),
        ]
    )
    
    config = {
        "column_name": "quantity",
        "expression": "pl.col('quantity') * 2",
    }
    
    result = await tool.get_output_schema(config, {"input": input_schema})
    output_schema = result["output"]
    
    # Column count should be unchanged
    assert len(output_schema.columns) == 3
    # Column order should be preserved
    column_names = [col.name for col in output_schema.columns]
    assert column_names == ["price", "quantity", "name"]


@pytest.mark.asyncio
async def test_formula_comparison():
    """Test comparison expressions"""
    tool = FormulaTool()
    
    df = pl.LazyFrame({
        "age": [25, 35, 45],
    })
    
    config = {
        "column_name": "is_senior",
        "expression": "pl.col('age') >= 40",
    }
    
    result = await tool.execute(config, {"input": df})
    output = result["output"].collect()
    
    assert "is_senior" in output.columns
    assert output["is_senior"].to_list() == [False, False, True]


@pytest.mark.asyncio
async def test_formula_conditional():
    """Test conditional expressions with pl.when"""
    tool = FormulaTool()
    
    df = pl.LazyFrame({
        "age": [25, 35, 45, 55],
    })
    
    config = {
        "column_name": "age_group",
        "expression": "pl.when(pl.col('age') < 30).then(pl.lit('Young')).when(pl.col('age') < 50).then(pl.lit('Middle')).otherwise(pl.lit('Senior'))",
    }
    
    result = await tool.execute(config, {"input": df})
    output = result["output"].collect()
    
    assert "age_group" in output.columns
    assert output["age_group"].to_list() == ["Young", "Middle", "Middle", "Senior"]


@pytest.mark.asyncio
async def test_formula_string_operations():
    """Test string operations"""
    tool = FormulaTool()
    
    df = pl.LazyFrame({
        "name": ["alice", "bob", "charlie"],
    })
    
    config = {
        "column_name": "name_upper",
        "expression": "pl.col('name').str.to_uppercase()",
    }
    
    result = await tool.execute(config, {"input": df})
    output = result["output"].collect()
    
    assert "name_upper" in output.columns
    assert output["name_upper"].to_list() == ["ALICE", "BOB", "CHARLIE"]


@pytest.mark.asyncio
async def test_formula_schema_inference():
    """Test that schema includes new column"""
    tool = FormulaTool()
    
    input_schema = DataSchema(
        columns=[
            ColumnSchema(name="price", dtype=PolarsDataType.FLOAT64, nullable=True),
            ColumnSchema(name="quantity", dtype=PolarsDataType.INT64, nullable=True),
        ]
    )
    
    config = {
        "column_name": "total",
        "expression": "pl.col('price') * pl.col('quantity')",
    }
    
    result = await tool.get_output_schema(config, {"input": input_schema})
    output_schema = result["output"]
    
    assert len(output_schema.columns) == 3
    column_names = [col.name for col in output_schema.columns]
    assert column_names == ["price", "quantity", "total"]


def test_formula_validation():
    """Test configuration validation"""
    tool = FormulaTool()
    
    # Missing column_name
    errors = tool.validate_config({"expression": "test"})
    assert len(errors) > 0
    assert any("column_name" in e for e in errors)
    
    # Missing expression
    errors = tool.validate_config({"column_name": "test"})
    assert len(errors) > 0
    assert any("expression" in e for e in errors)
    
    # Valid config for new column
    errors = tool.validate_config({
        "column_name": "test",
        "expression": "pl.col('a') + pl.col('b')",
    })
    assert len(errors) == 0
    
    # Valid config with replace flag
    errors = tool.validate_config({
        "column_name": "existing_col",
        "replace": True,
        "expression": "pl.col('a') + pl.col('b')",
    })
    assert len(errors) == 0


@pytest.mark.asyncio
async def test_formula_invalid_expression():
    """Test that invalid expressions raise errors"""
    tool = FormulaTool()
    
    df = pl.LazyFrame({"a": [1, 2, 3]})
    
    config = {
        "column_name": "result",
        "expression": "pl.col('nonexistent')",
    }
    
    with pytest.raises(Exception):
        result = await tool.execute(config, {"input": df})
        result["output"].collect()


class TestFormulaCodeGeneration:
    """Tests for FormulaTool.to_python_code()"""

    def test_code_gen_basic_formula(self):
        """Test basic formula code generation"""
        tool = FormulaTool()
        config = {
            "column_name": "total",
            "expression": "pl.col('price') * pl.col('quantity')",
        }
        input_vars = {"input": "df_input"}

        lines, output_vars = tool.to_python_code("formula1", config, input_vars)

        assert len(lines) == 1
        assert "df_formula1" in lines[0]
        assert "with_columns" in lines[0]
        assert "pl.col('price') * pl.col('quantity')" in lines[0]
        assert '.alias("total")' in lines[0]
        assert output_vars == {"output": "df_formula1"}

    def test_code_gen_empty_config(self):
        """Test code generation with empty/missing config"""
        tool = FormulaTool()
        config = {}
        input_vars = {"input": "df_source"}

        lines, output_vars = tool.to_python_code("fml", config, input_vars)

        # Should pass through when config is incomplete
        assert len(lines) == 1
        assert "df_fml = df_source" in lines[0]
        assert output_vars == {"output": "df_fml"}

    def test_code_gen_multiline_expression(self):
        """Test code generation normalizes multiline expressions"""
        tool = FormulaTool()
        config = {
            "column_name": "status",
            "expression": """pl.when(pl.col('x') > 0)
                .then(pl.lit('Positive'))
                .otherwise(pl.lit('Negative'))""",
        }
        input_vars = {"input": "df_data"}

        lines, output_vars = tool.to_python_code("fmla", config, input_vars)

        assert len(lines) == 1
        # Expression should be normalized to single line
        assert "\n" not in lines[0]
        assert "with_columns" in lines[0]
        assert '.alias("status")' in lines[0]
        assert output_vars == {"output": "df_fmla"}

    def test_code_gen_replace_column(self):
        """Test code generation for replacing existing column"""
        tool = FormulaTool()
        config = {
            "column_name": "price",
            "expression": "pl.col('price') * 1.1",
        }
        input_vars = {"input": "df_in"}

        lines, output_vars = tool.to_python_code("adj", config, input_vars)

        assert len(lines) == 1
        assert "with_columns" in lines[0]
        assert "pl.col('price') * 1.1" in lines[0]
        assert '.alias("price")' in lines[0]
        assert output_vars == {"output": "df_adj"}
