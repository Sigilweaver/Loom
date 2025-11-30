"""Sort tool implementation - Sort data by one or more columns"""

from typing import Any

import polars as pl

from app.api.models.common import DataSchema, ColumnSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError


# Valid sort directions
SORT_DIRECTIONS = {"asc", "desc"}


@register_tool("Sort")
class SortTool(BaseTool):
    """
    Sort data by one or more columns.

    Config:
    - sortColumns: list[dict] - sort column definitions
      Each dict contains:
        - column: str - column to sort by
        - direction: str - 'asc' or 'desc' (default: 'asc')
        - nullsFirst: bool - whether nulls should come first (default: False)
    """

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame]
    ) -> dict[str, pl.LazyFrame]:
        """
        Execute sort operation.
        """
        # Get input LazyFrame
        if "input" not in inputs:
            raise ToolError("Sort tool requires input on socket 'input'")

        lf = inputs["input"]
        
        sort_columns = config.get("sortColumns", [])
        
        # If no sort columns, pass through unchanged
        if not sort_columns:
            return {"output": lf}

        # Build sort expressions
        by_columns: list[str] = []
        descending: list[bool] = []
        nulls_last: list[bool] = []
        
        for sort_col in sort_columns:
            column = sort_col.get("column")
            direction = sort_col.get("direction", "asc")
            nulls_first = sort_col.get("nullsFirst", False)
            
            if not column:
                raise ToolError("Sort column name is required")
            
            if direction not in SORT_DIRECTIONS:
                raise ToolError(f"Invalid sort direction: {direction}. Must be 'asc' or 'desc'")

            by_columns.append(column)
            descending.append(direction == "desc")
            nulls_last.append(not nulls_first)

        # Apply sort
        result = lf.sort(
            by=by_columns,
            descending=descending,
            nulls_last=nulls_last,
        )

        return {"output": result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema]
    ) -> dict[str, DataSchema]:
        """
        Sort preserves the input schema exactly.
        """
        if "input" not in input_schemas:
            raise ToolError("Sort tool requires input schema on socket 'input'")

        # Sort doesn't change the schema, just the row order
        return {"output": input_schemas["input"]}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate sort configuration"""
        errors = []

        sort_columns = config.get("sortColumns", [])
        
        # Empty sort columns is valid (pass-through)
        if not sort_columns:
            return errors

        seen_columns: set[str] = set()

        for i, sort_col in enumerate(sort_columns):
            if not isinstance(sort_col, dict):
                errors.append(f"Sort column at index {i} must be an object")
                continue

            column = sort_col.get("column")
            direction = sort_col.get("direction", "asc")

            if not column:
                errors.append(f"Sort column at index {i} is missing 'column'")
                continue

            if direction not in SORT_DIRECTIONS:
                errors.append(f"Invalid sort direction at index {i}: '{direction}'. Must be 'asc' or 'desc'")

            # Check for duplicate columns
            if column in seen_columns:
                errors.append(f"Duplicate sort column: '{column}'")
            seen_columns.add(column)

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Sort tool"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines = []
        
        sort_columns = config.get("sortColumns", [])

        # Get input variable name
        input_var = input_vars.get("input", "df_input")

        # Generate output variable name
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        # Handle empty sort columns (pass-through)
        if not sort_columns:
            lines.append(f"{var_name} = {input_var}")
            return (lines, {"output": var_name})

        # Build sort arguments
        by_columns: list[str] = []
        descending: list[str] = []
        nulls_last: list[str] = []
        
        for sort_col in sort_columns:
            column = sort_col.get("column")
            direction = sort_col.get("direction", "asc")
            nulls_first = sort_col.get("nullsFirst", False)
            
            if not column:
                continue

            by_columns.append(f'"{column}"')
            descending.append("True" if direction == "desc" else "False")
            nulls_last.append("False" if nulls_first else "True")

        # Generate the code
        by_str = ", ".join(by_columns)
        desc_str = ", ".join(descending)
        nulls_str = ", ".join(nulls_last)

        lines.append(f"{var_name} = {input_var}.sort(")
        lines.append(f"    by=[{by_str}],")
        lines.append(f"    descending=[{desc_str}],")
        lines.append(f"    nulls_last=[{nulls_str}],")
        lines.append(")")

        return (lines, {"output": var_name})
