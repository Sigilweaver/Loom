"""Formula tool implementation - Add or replace calculated columns"""

from typing import Any

import polars as pl

from app.api.models.common import ColumnSchema, DataSchema, PolarsDataType
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import FormulaOperation
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError


@register_tool("Formula")
class FormulaTool(BaseTool):
    """
    Add or replace calculated columns using Polars expressions.
    
    Users write Polars expressions directly:
    - pl.col('age') > 30
    - pl.col('price') * pl.col('quantity')
    - pl.when(pl.col('x') > 0).then(pl.lit('Positive')).otherwise(pl.lit('Negative'))
    
    Frontend provides helper buttons to build common patterns.
    
    Note: If column_name matches an existing column, Polars automatically
    replaces it in place (maintaining column order).

    Config:
    - column_name: Name of the column to create or replace
    - expression: Polars expression string
    """

    def _build_operation(self, config: dict[str, Any]) -> FormulaOperation:
        """Build the formula operation from config."""
        return FormulaOperation(
            column_name=config.get("column_name", ""),
            expr_str=config.get("expression", ""),
        )

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame]
    ) -> dict[str, pl.LazyFrame]:
        """
        Add or replace calculated column in DataFrame.
        
        If column_name matches an existing column, it is replaced in place.

        Config should contain:
        - column_name: str - name of the column
        - expression: str - Polars expression
        """
        if "input" not in inputs:
            raise ToolError("Formula tool requires input on socket 'input'")

        lf = inputs["input"]
        column_name = config.get("column_name", "")
        expression = config.get("expression")

        if not column_name:
            raise ToolError("Formula tool requires 'column_name' in config")
        if not expression:
            raise ToolError("Formula tool requires 'expression' in config")

        op = self._build_operation(config)
        lf = op.execute(lf)

        return {"output": lf}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema]
    ) -> dict[str, DataSchema]:
        """
        Calculate output schema - input schema with new/replaced column.
        
        Note: We don't know the exact type without executing,
        so we return a generic type.
        """
        if "input" not in input_schemas:
            raise ToolError("Formula tool requires input schema on socket 'input'")

        input_schema = input_schemas["input"]
        column_name = config.get("column_name", "")

        if not column_name:
            raise ToolError("Formula tool requires 'column_name' in config")

        # Create the new/updated column schema
        new_column = ColumnSchema(
            name=column_name,
            dtype=PolarsDataType.STRING,  # Default assumption
            nullable=True,
            description=f"Calculated: {config.get('expression', '')}",
        )

        # Check if column exists - if so, Polars replaces it in place
        existing_column_names = [col.name for col in input_schema.columns]
        column_exists = column_name in existing_column_names

        if column_exists:
            # Replace existing column - maintain column order
            output_columns = []
            for col in input_schema.columns:
                if col.name == column_name:
                    output_columns.append(new_column)
                else:
                    output_columns.append(col)
        else:
            # Add new column at the end
            output_columns = list(input_schema.columns)
            output_columns.append(new_column)

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

        if "column_name" not in config or not config.get("column_name"):
            errors.append("Missing required field: column_name")
        elif not isinstance(config["column_name"], str):
            errors.append("column_name must be a string")

        if "expression" not in config:
            errors.append("Missing required field: expression")
        elif not isinstance(config["expression"], str):
            errors.append("expression must be a string")

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Formula tool - uses same operation as execute()"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        input_var = input_vars.get("input", "df_input")
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        # Use the same operation builder as execute()
        op = self._build_operation(config)
        lines = op.to_code(input_var, var_name)

        return (lines, {"output": var_name})

