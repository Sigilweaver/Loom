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
    
    result = await tool.execute(config, {0: df})
    output = result[1].collect()
    
    assert "total" in output.columns
    assert output["total"].to_list() == [20, 60, 120]


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
    
    result = await tool.execute(config, {0: df})
    output = result[1].collect()
    
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
    
    result = await tool.execute(config, {0: df})
    output = result[1].collect()
    
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
    
    result = await tool.execute(config, {0: df})
    output = result[1].collect()
    
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
    
    result = await tool.get_output_schema(config, {0: input_schema})
    output_schema = result[1]
    
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
    
    # Valid config
    errors = tool.validate_config({
        "column_name": "test",
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
        result = await tool.execute(config, {0: df})
        result[1].collect()
