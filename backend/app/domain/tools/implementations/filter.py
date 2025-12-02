"""Filter tool implementation - Filter rows based on expressions"""

from typing import Any

import polars as pl

from app.api.models.common import DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import FilterOperation
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError
from app.utils.expression import parse_polars_expression


@register_tool("Filter")
class FilterTool(BaseTool):
    """
    Filter rows based on a Polars expression.

    Returns two outputs:
    - Socket output-true (T): Rows that match the filter
    - Socket output-false (F): Rows that don't match the filter
    """

    def _build_operation(self, config: dict[str, Any]) -> FilterOperation:
        """Build the filter operation from config."""
        return FilterOperation(expr_str=config.get("expression", ""))

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """
        Filter data based on expression.

        Config should contain:
        - expression: Polars expression string (e.g., "pl.col('amount') > 100")
        """
        if "input" not in inputs:
            raise ToolError("Filter tool requires input on socket 'input'")

        input_data = inputs["input"]
        if isinstance(input_data, list):
            raise ToolError("Filter tool does not support multiple inputs")
        lf: pl.LazyFrame = input_data

        op = self._build_operation(config)
        lf_true, lf_false = op.execute(lf)

        return {
            "output-true": lf_true,
            "output-false": lf_false,
        }

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Output schema is same as input schema for both outputs.

        Filter doesn't change schema, just removes rows.
        """
        if "input" not in input_schemas:
            raise ToolError("Filter tool requires input schema on socket 'input'")

        input_data = input_schemas["input"]
        if isinstance(input_data, list):
            raise ToolError("Filter tool does not support multiple input schemas")
        input_schema: DataSchema = input_data

        return {
            "output-true": input_schema,  # T output - same schema
            "output-false": input_schema,  # F output - same schema
        }

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate filter configuration"""
        errors = []

        expression = config.get("expression", "")
        if not expression or expression.strip() == "":
            errors.append("Filter expression is empty")
        else:
            # Try to parse expression using shared utility
            try:
                parse_polars_expression(expression)
            except ToolError as e:
                errors.append(str(e))

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Filter tool - uses same operation as execute()"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        input_var = self._get_input_var(input_vars.get("input"))
        var_t = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}_t"
        var_f = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}_f"

        # Use the same operation builder as execute()
        op = self._build_operation(config)
        lines = op.to_code(input_var, var_t, var_f)

        return (lines, {"output-true": var_t, "output-false": var_f})
