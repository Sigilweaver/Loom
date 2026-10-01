"""Tests for Formula tool"""

import polars as pl
import pytest

from app.domain.models.common import ColumnSchema, DataSchema, PolarsDataType
from app.domain.tools.implementations.formula import FormulaTool

# ============================================================================
# Legacy single-operation tests (backward compatibility)
# ============================================================================


@pytest.mark.asyncio
async def test_formula_arithmetic():
    """Test arithmetic expressions"""
    tool = FormulaTool()

    df = pl.LazyFrame(
        {
            "price": [10, 20, 30],
            "quantity": [2, 3, 4],
        }
    )

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

    df = pl.LazyFrame(
        {
            "price": [10.0, 20.0, 30.0],
            "quantity": [2, 3, 4],
        }
    )

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

    df = pl.LazyFrame(
        {
            "a": [1, 2, 3],
            "b": [4, 5, 6],
            "c": [7, 8, 9],
        }
    )

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

    df = pl.LazyFrame(
        {
            "age": [25, 35, 45],
        }
    )

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

    df = pl.LazyFrame(
        {
            "age": [25, 35, 45, 55],
        }
    )

    config = {
        "column_name": "age_group",
        "expression": (
            "pl.when(pl.col('age') < 30).then(pl.lit('Young'))"
            ".when(pl.col('age') < 50).then(pl.lit('Middle'))"
            ".otherwise(pl.lit('Senior'))"
        ),
    }

    result = await tool.execute(config, {"input": df})
    output = result["output"].collect()

    assert "age_group" in output.columns
    assert output["age_group"].to_list() == ["Young", "Middle", "Middle", "Senior"]


@pytest.mark.asyncio
async def test_formula_string_operations():
    """Test string operations"""
    tool = FormulaTool()

    df = pl.LazyFrame(
        {
            "name": ["alice", "bob", "charlie"],
        }
    )

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


@pytest.mark.asyncio
async def test_formula_validation():
    """Test configuration validation"""
    tool = FormulaTool()

    # Missing column_name
    errors = await tool.validate_config({"expression": "test"})
    assert len(errors) > 0
    assert any("column_name" in e for e in errors)

    # Missing expression
    errors = await tool.validate_config({"column_name": "test"})
    assert len(errors) > 0
    assert any("expression" in e for e in errors)

    # Valid config for new column
    errors = await tool.validate_config(
        {
            "column_name": "test",
            "expression": "pl.col('a') + pl.col('b')",
        }
    )
    assert len(errors) == 0

    # Valid config with replace flag
    errors = await tool.validate_config(
        {
            "column_name": "existing_col",
            "replace": True,
            "expression": "pl.col('a') + pl.col('b')",
        }
    )
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


# ============================================================================
# Multi-operation tests (new format)
# ============================================================================


@pytest.mark.asyncio
async def test_formula_multi_operation():
    """Test multiple operations in a single Formula tool"""
    tool = FormulaTool()

    df = pl.LazyFrame(
        {
            "price": [10.0, 20.0, 30.0],
            "quantity": [2, 3, 4],
        }
    )

    config = {
        "operations": [
            {
                "column_name": "total",
                "expression": "pl.col('price') * pl.col('quantity')",
            },
            {
                "column_name": "total_with_tax",
                "expression": "pl.col('total') * 1.1",
            },
        ],
    }

    result = await tool.execute(config, {"input": df})
    output = result["output"].collect()

    assert "total" in output.columns
    assert "total_with_tax" in output.columns
    assert output["total"].to_list() == [20.0, 60.0, 120.0]
    # total_with_tax should reference the column created by operation 1
    assert output["total_with_tax"].to_list() == [22.0, 66.0, 132.0]


@pytest.mark.asyncio
async def test_formula_multi_operation_chaining():
    """Test that later operations can reference columns from earlier operations"""
    tool = FormulaTool()

    df = pl.LazyFrame(
        {
            "value": [100, 200, 300],
        }
    )

    config = {
        "operations": [
            {
                "column_name": "doubled",
                "expression": "pl.col('value') * 2",
            },
            {
                "column_name": "quadrupled",
                "expression": "pl.col('doubled') * 2",
            },
            {
                "column_name": "label",
                "expression": (
                    "pl.when(pl.col('quadrupled') > 500)"
                    ".then(pl.lit('big'))"
                    ".otherwise(pl.lit('small'))"
                ),
            },
        ],
    }

    result = await tool.execute(config, {"input": df})
    output = result["output"].collect()

    assert output.columns == ["value", "doubled", "quadrupled", "label"]
    assert output["doubled"].to_list() == [200, 400, 600]
    assert output["quadrupled"].to_list() == [400, 800, 1200]
    assert output["label"].to_list() == ["small", "big", "big"]


@pytest.mark.asyncio
async def test_formula_multi_operation_schema():
    """Test schema accumulates across multiple operations"""
    tool = FormulaTool()

    input_schema = DataSchema(
        columns=[
            ColumnSchema(name="a", dtype=PolarsDataType.INT64, nullable=True),
            ColumnSchema(name="b", dtype=PolarsDataType.INT64, nullable=True),
        ]
    )

    config = {
        "operations": [
            {
                "column_name": "c",
                "expression": "pl.col('a') + pl.col('b')",
            },
            {
                "column_name": "d",
                "expression": "pl.col('a') > 0",
            },
        ],
    }

    result = await tool.get_output_schema(config, {"input": input_schema})
    output_schema = result["output"]

    column_names = [col.name for col in output_schema.columns]
    assert column_names == ["a", "b", "c", "d"]
    assert len(output_schema.columns) == 4


@pytest.mark.asyncio
async def test_formula_multi_operation_replace_and_add():
    """Test mixing column replacement and addition in multi-operation"""
    tool = FormulaTool()

    df = pl.LazyFrame(
        {
            "price": [10.0, 20.0],
            "name": ["foo", "bar"],
        }
    )

    config = {
        "operations": [
            {
                "column_name": "price",
                "expression": "pl.col('price') * 1.1",
            },
            {
                "column_name": "name_upper",
                "expression": "pl.col('name').str.to_uppercase()",
            },
        ],
    }

    result = await tool.execute(config, {"input": df})
    output = result["output"].collect()

    assert output.columns == ["price", "name", "name_upper"]
    assert output["price"].to_list() == [11.0, 22.0]
    assert output["name_upper"].to_list() == ["FOO", "BAR"]


@pytest.mark.asyncio
async def test_formula_multi_operation_validation():
    """Test validation for multi-operation config"""
    tool = FormulaTool()

    # Valid multi-operation
    errors = await tool.validate_config(
        {
            "operations": [
                {"column_name": "a", "expression": "pl.col('x') + 1"},
                {"column_name": "b", "expression": "pl.col('y') + 2"},
            ],
        }
    )
    assert len(errors) == 0

    # Missing column_name in one operation
    errors = await tool.validate_config(
        {
            "operations": [
                {"column_name": "", "expression": "pl.col('x') + 1"},
            ],
        }
    )
    assert len(errors) > 0
    assert any("column_name" in e for e in errors)

    # Missing expression in one operation
    errors = await tool.validate_config(
        {
            "operations": [
                {"column_name": "a", "expression": ""},
            ],
        }
    )
    assert len(errors) > 0
    assert any("expression" in e for e in errors)


@pytest.mark.asyncio
async def test_formula_validation_catches_syntax_errors():
    """Test that validate_config catches expression syntax errors"""
    tool = FormulaTool()

    errors = await tool.validate_config(
        {
            "column_name": "test",
            "expression": "pl.col('a') ++ invalid_syntax",
        }
    )
    assert len(errors) > 0
    assert any("nvalid expression" in e for e in errors)


@pytest.mark.asyncio
async def test_formula_multi_operation_error_in_middle():
    """Test that an error in one operation gives a clear message"""
    tool = FormulaTool()

    df = pl.LazyFrame({"x": [1, 2, 3]})

    config = {
        "operations": [
            {"column_name": "a", "expression": "pl.col('x') + 1"},
            {"column_name": "", "expression": "pl.col('a') + 1"},
        ],
    }

    with pytest.raises(Exception, match="Operation 2"):
        await tool.execute(config, {"input": df})


# ============================================================================
# Schema type inference tests
# ============================================================================


@pytest.mark.asyncio
async def test_formula_schema_type_inference_arithmetic():
    """Test that arithmetic expression infers numeric type"""
    tool = FormulaTool()

    input_schema = DataSchema(
        columns=[
            ColumnSchema(name="price", dtype=PolarsDataType.FLOAT64, nullable=True),
            ColumnSchema(name="qty", dtype=PolarsDataType.INT64, nullable=True),
        ]
    )

    config = {
        "column_name": "total",
        "expression": "pl.col('price') * pl.col('qty')",
    }

    result = await tool.get_output_schema(config, {"input": input_schema})
    total_col = next(c for c in result["output"].columns if c.name == "total")

    # Should infer Float64 (not default STRING)
    assert total_col.dtype == PolarsDataType.FLOAT64


@pytest.mark.asyncio
async def test_formula_schema_type_inference_boolean():
    """Test that comparison expression infers Boolean type"""
    tool = FormulaTool()

    input_schema = DataSchema(
        columns=[
            ColumnSchema(name="age", dtype=PolarsDataType.INT64, nullable=True),
        ]
    )

    config = {
        "column_name": "is_adult",
        "expression": "pl.col('age') >= 18",
    }

    result = await tool.get_output_schema(config, {"input": input_schema})
    col = next(c for c in result["output"].columns if c.name == "is_adult")
    assert col.dtype == PolarsDataType.BOOLEAN


@pytest.mark.asyncio
async def test_formula_schema_type_inference_string():
    """Test that string expression infers String type"""
    tool = FormulaTool()

    input_schema = DataSchema(
        columns=[
            ColumnSchema(name="name", dtype=PolarsDataType.STRING, nullable=True),
        ]
    )

    config = {
        "column_name": "name_upper",
        "expression": "pl.col('name').str.to_uppercase()",
    }

    result = await tool.get_output_schema(config, {"input": input_schema})
    col = next(c for c in result["output"].columns if c.name == "name_upper")
    assert col.dtype == PolarsDataType.STRING


@pytest.mark.asyncio
async def test_formula_schema_type_inference_fallback():
    """Test that inference falls back to STRING on unparseable expression"""
    tool = FormulaTool()

    input_schema = DataSchema(
        columns=[
            ColumnSchema(name="x", dtype=PolarsDataType.INT64, nullable=True),
        ]
    )

    config = {
        "column_name": "result",
        "expression": "this is not valid python",
    }

    # Should not crash - falls back to STRING
    result = await tool.get_output_schema(config, {"input": input_schema})
    col = next(c for c in result["output"].columns if c.name == "result")
    assert col.dtype == PolarsDataType.STRING


# ============================================================================
# Code generation tests
# ============================================================================


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
        """Test code generation preserves multiline expressions wrapped in parens"""
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
        # Expression is wrapped in parens, newlines are preserved (valid Python)
        assert "with_columns" in lines[0]
        assert '.alias("status")' in lines[0]
        assert "pl.when(pl.col('x') > 0)" in lines[0]
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

    def test_code_gen_multi_operation(self):
        """Test code generation for multi-operation config"""
        tool = FormulaTool()
        config = {
            "operations": [
                {
                    "column_name": "total",
                    "expression": "pl.col('price') * pl.col('qty')",
                },
                {
                    "column_name": "tax",
                    "expression": "pl.col('total') * 0.1",
                },
            ],
        }
        input_vars = {"input": "df_in"}

        lines, output_vars = tool.to_python_code("calc", config, input_vars)

        # Should produce two lines with intermediate variable
        assert len(lines) == 2
        assert "with_columns" in lines[0]
        assert "with_columns" in lines[1]
        assert '.alias("total")' in lines[0]
        assert '.alias("tax")' in lines[1]
        assert output_vars == {"output": "df_calc"}
