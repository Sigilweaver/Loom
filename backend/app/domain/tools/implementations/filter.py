"""Filter tool implementation - Filter rows based on expressions"""

from typing import Any

import polars as pl

from app.api.models.common import DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError


@register_tool("Filter")
class FilterTool(BaseTool):
    """
    Filter rows based on a Polars expression.

    Returns two outputs:
    - Socket 1 (T): Rows that match the filter
    - Socket 2 (F): Rows that don't match the filter
    """

    async def execute(
        self, config: dict[str, Any], inputs: dict[int, pl.LazyFrame]
    ) -> dict[int, pl.LazyFrame]:
        """
        Filter data based on expression.

        Config should contain:
        - expression: Polars expression string (e.g., "pl.col('amount') > 100")
        """
        # Get input LazyFrame
        if 0 not in inputs:
            raise ToolError("Filter tool requires input on socket 0")

        lf = inputs[0]

        # Get filter expression
        expression = config.get("expression", "")
        if not expression or expression.strip() == "":
            # No filter - all rows pass
            return {
                1: lf,  # T output - all rows
                2: lf.clear(),  # F output - empty
            }

        # Parse and apply filter expression
        filter_expr = self._parse_expression(expression)

        # Split into T and F outputs
        lf_true = lf.filter(filter_expr)
        lf_false = lf.filter(~filter_expr)

        return {
            1: lf_true,  # Socket 1 - T output (matches)
            2: lf_false,  # Socket 2 - F output (doesn't match)
        }

    def _parse_expression(self, expression: str) -> pl.Expr:
        """
        Parse filter expression string into Polars expression.

        For MVP, we'll use eval with restricted namespace.
        Future: proper expression parser/DSL.

        Examples:
        - "pl.col('amount') > 100"
        - "pl.col('name').str.contains('test')"
        - "(pl.col('a') > 10) & (pl.col('b') < 20)"
        """
        # Create restricted namespace for eval
        namespace = {
            "pl": pl,
            # Add safe built-ins if needed
        }

        try:
            # Evaluate expression
            expr = eval(expression, {"__builtins__": {}}, namespace)

            if not isinstance(expr, pl.Expr):
                raise ToolError(
                    f"Expression must evaluate to pl.Expr, got {type(expr).__name__}"
                )

            return expr

        except Exception as e:
            raise ToolError(f"Failed to parse expression: {str(e)}") from e

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[int, DataSchema]
    ) -> dict[int, DataSchema]:
        """
        Output schema is same as input schema for both outputs.

        Filter doesn't change schema, just removes rows.
        """
        if 0 not in input_schemas:
            raise ToolError("Filter tool requires input schema on socket 0")

        input_schema = input_schemas[0]

        return {
            1: input_schema,  # T output - same schema
            2: input_schema,  # F output - same schema
        }

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate filter configuration"""
        errors = []

        expression = config.get("expression", "")
        if not expression or expression.strip() == "":
            errors.append("Filter expression is empty")
        else:
            # Try to parse expression
            try:
                self._parse_expression(expression)
            except ToolError as e:
                errors.append(str(e))

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[int, str],
    ) -> tuple[list[str], dict[int, str]]:
        """Generate Python code for Filter tool"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines = []
        expression = config.get("expression", "")

        # Get input variable name
        input_var = input_vars.get(0, "df_input")

        # Generate output variable names
        var_t = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}_t"
        var_f = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}_f"

        if not expression or expression.strip() == "":
            # No filter - all rows pass through
            lines.append(f"{var_t} = {input_var}")
            lines.append(f"{var_f} = {input_var}.clear()")
        else:
            # Apply filter expression
            lines.append(f"{var_t} = {input_var}.filter({expression})")
            lines.append(f"{var_f} = {input_var}.filter(~({expression}))")

        return (lines, {1: var_t, 2: var_f})
