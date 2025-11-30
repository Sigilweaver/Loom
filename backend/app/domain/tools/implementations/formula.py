"""Formula tool implementation - Add calculated columns"""

from typing import Any

import polars as pl

from app.api.models.common import DataSchema, ColumnSchema, PolarsDataType
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError


@register_tool("Formula")
class FormulaTool(BaseTool):
    """
    Add calculated columns using Polars expressions.
    
    Users write Polars expressions directly:
    - pl.col('age') > 30
    - pl.col('price') * pl.col('quantity')
    - pl.when(pl.col('x') > 0).then(pl.lit('Positive')).otherwise(pl.lit('Negative'))
    
    Frontend provides helper buttons to build common patterns.

    Config:
    - column_name: Name of new column to create
    - expression: Polars expression string
    """

    def _parse_expression(self, expression: str) -> pl.Expr:
        """
        Parse Polars expression string.
        
        Evaluates the expression with only the pl module available.
        Normalizes whitespace to allow multi-line expressions for readability.
        """
        # Normalize expression: replace newlines/extra whitespace with single spaces
        # This allows users to write expressions across multiple lines
        expression = " ".join(expression.split())

        try:
            expr = eval(expression, {"pl": pl, "__builtins__": {}})
            if not isinstance(expr, pl.Expr):
                raise ToolError(f"Expression must return a Polars expression, got {type(expr)}")
            return expr
        except Exception as e:
            raise ToolError(f"Invalid expression '{expression}': {str(e)}")

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame]
    ) -> dict[str, pl.LazyFrame]:
        """
        Add calculated column to DataFrame.

        Config should contain:
        - column_name: str - name of new column
        - expression: str - Polars expression
        """
        if "input" not in inputs:
            raise ToolError("Formula tool requires input on socket 'input'")

        lf = inputs["input"]
        column_name = config.get("column_name")
        expression = config.get("expression")

        if not column_name:
            raise ToolError("Formula tool requires 'column_name' in config")
        if not expression:
            raise ToolError("Formula tool requires 'expression' in config")

        # Parse and execute expression
        expr = self._parse_expression(expression)
        lf = lf.with_columns(expr.alias(column_name))

        return {"output": lf}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema]
    ) -> dict[str, DataSchema]:
        """
        Calculate output schema - input schema + new column.
        
        Note: We don't know the exact type without executing,
        so we return a generic type.
        """
        if "input" not in input_schemas:
            raise ToolError("Formula tool requires input schema on socket 'input'")

        input_schema = input_schemas["input"]
        column_name = config.get("column_name")

        if not column_name:
            raise ToolError("Formula tool requires 'column_name' in config")

        # Add new column with unknown type
        new_column = ColumnSchema(
            name=column_name,
            dtype=PolarsDataType.STRING,  # Default assumption
            nullable=True,
            description=f"Calculated: {config.get('expression', '')}",
        )

        output_columns = list(input_schema.columns) + [new_column]

        return {
            "output": DataSchema(
                columns=output_columns,
                row_count=input_schema.row_count,
                file_size_bytes=None,
            )
        }

    def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate formula configuration"""
        errors = []

        if "column_name" not in config:
            errors.append("Missing required field: column_name")
        elif not isinstance(config["column_name"], str):
            errors.append("column_name must be a string")

        if "expression" not in config:
            errors.append("Missing required field: expression")
        elif not isinstance(config["expression"], str):
            errors.append("expression must be a string")

        return errors
