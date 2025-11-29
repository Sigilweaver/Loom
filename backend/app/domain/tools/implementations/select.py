"""Select tool implementation - Select, rename, reorder, and cast columns"""

from typing import Any

import polars as pl

from app.api.models.common import DataSchema, ColumnSchema, PolarsDataType
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError


# Mapping from PolarsDataType string to actual Polars type for casting
DTYPE_STRING_TO_POLARS: dict[str, pl.DataType] = {
    "Int8": pl.Int8,
    "Int16": pl.Int16,
    "Int32": pl.Int32,
    "Int64": pl.Int64,
    "UInt8": pl.UInt8,
    "UInt16": pl.UInt16,
    "UInt32": pl.UInt32,
    "UInt64": pl.UInt64,
    "Float32": pl.Float32,
    "Float64": pl.Float64,
    "Boolean": pl.Boolean,
    "Utf8": pl.Utf8,
    "String": pl.String,
    "Date": pl.Date,
    "Datetime": pl.Datetime,
    "Time": pl.Time,
    "Duration": pl.Duration,
    "Categorical": pl.Categorical,
}


@register_tool("Select")
class SelectTool(BaseTool):
    """
    Select, rename, reorder, and cast columns from DataFrame.

    Config:
    - columnConfigs: list of column configuration objects
      Each object contains:
        - name: str - original column name
        - selected: bool - whether to include in output
        - rename: str | None - new name (optional)
        - targetType: str | None - cast to this type (optional)
        - size: int | None - max string length (optional, for String type)
    """

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame]
    ) -> dict[str, pl.LazyFrame]:
        """
        Execute column selection, renaming, reordering, and type casting.

        Config should contain:
        - columnConfigs: list[dict] - column configurations
        """
        # Get input LazyFrame
        if "input" not in inputs:
            raise ToolError("Select tool requires input on socket 'input'")

        lf = inputs["input"]
        column_configs = config.get("columnConfigs", [])

        # If no column configs, pass through unchanged
        if not column_configs:
            return {"output": lf}

        # Build list of expressions for selected columns (maintains order)
        expressions: list[pl.Expr] = []

        for col_config in column_configs:
            name = col_config.get("name")
            selected = col_config.get("selected", True)
            rename = col_config.get("rename")
            target_type = col_config.get("targetType")
            size = col_config.get("size")

            if not name:
                continue

            if not selected:
                # Skip deselected columns
                continue

            # Start with column reference
            expr = pl.col(name)

            # Apply type cast if specified
            if target_type and target_type in DTYPE_STRING_TO_POLARS:
                expr = expr.cast(DTYPE_STRING_TO_POLARS[target_type])

            # Apply string truncation if specified (only for string types)
            if size is not None and size > 0:
                # Check if we're dealing with a string type
                # Apply truncation using str.head
                if target_type in ("String", "Utf8") or target_type is None:
                    expr = expr.str.head(size)

            # Apply rename if specified
            if rename and rename.strip():
                expr = expr.alias(rename.strip())
            else:
                # Keep original name
                expr = expr.alias(name)

            expressions.append(expr)

        if not expressions:
            # All columns deselected - return empty frame with no columns
            # This is an edge case, return a frame with just the row structure
            raise ToolError("At least one column must be selected")

        # Apply all transformations
        lf = lf.select(expressions)

        return {"output": lf}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema]
    ) -> dict[str, DataSchema]:
        """
        Calculate output schema based on column configuration.
        """
        if "input" not in input_schemas:
            raise ToolError("Select tool requires input schema on socket 'input'")

        input_schema = input_schemas["input"]
        column_configs = config.get("columnConfigs", [])

        # If no column configs, pass through unchanged
        if not column_configs:
            return {"output": input_schema}

        # Build output columns based on config
        output_columns: list[ColumnSchema] = []

        # Create a lookup for input column schemas
        input_column_map = {col.name: col for col in input_schema.columns}

        for col_config in column_configs:
            name = col_config.get("name")
            selected = col_config.get("selected", True)
            rename = col_config.get("rename")
            target_type = col_config.get("targetType")

            if not name or not selected:
                continue

            # Get original column schema
            original_col = input_column_map.get(name)
            if not original_col:
                # Column doesn't exist in input - skip
                continue

            # Determine output name
            output_name = rename.strip() if rename and rename.strip() else name

            # Determine output type
            if target_type:
                try:
                    output_dtype = PolarsDataType(target_type)
                except ValueError:
                    output_dtype = original_col.dtype
            else:
                output_dtype = original_col.dtype

            output_columns.append(
                ColumnSchema(
                    name=output_name,
                    dtype=output_dtype,
                    nullable=original_col.nullable,
                )
            )

        if not output_columns:
            raise ToolError("At least one column must be selected")

        return {"output": DataSchema(
            columns=output_columns,
            row_count=input_schema.row_count,
            file_size_bytes=None,
        )}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate select configuration"""
        errors = []

        column_configs = config.get("columnConfigs")

        # Empty config is valid (pass-through mode)
        if column_configs is None or len(column_configs) == 0:
            return errors

        if not isinstance(column_configs, list):
            errors.append("Field 'columnConfigs' must be a list")
            return errors

        # Check that at least one column is selected
        selected_count = sum(
            1 for cc in column_configs
            if isinstance(cc, dict) and cc.get("selected", True)
        )

        if selected_count == 0:
            errors.append("At least one column must be selected")

        # Validate individual column configs
        seen_output_names: set[str] = set()
        for i, col_config in enumerate(column_configs):
            if not isinstance(col_config, dict):
                errors.append(f"Column config at index {i} must be an object")
                continue

            name = col_config.get("name")
            if not name:
                errors.append(f"Column config at index {i} missing 'name' field")
                continue

            # Check for duplicate output names
            rename = col_config.get("rename")
            output_name = rename.strip() if rename and rename.strip() else name

            if output_name in seen_output_names:
                errors.append(f"Duplicate output column name: '{output_name}'")
            seen_output_names.add(output_name)

            # Validate target type if specified
            target_type = col_config.get("targetType")
            if target_type and target_type not in DTYPE_STRING_TO_POLARS:
                errors.append(
                    f"Invalid target type '{target_type}' for column '{name}'"
                )

            # Validate size if specified
            size = col_config.get("size")
            if size is not None:
                if not isinstance(size, int) or size < 1:
                    errors.append(
                        f"Size for column '{name}' must be a positive integer"
                    )

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[int, str],
    ) -> tuple[list[str], dict[int, str]]:
        """Generate Python code for Select tool"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines = []
        column_configs = config.get("columnConfigs", [])

        # Get input variable name
        input_var = input_vars.get(0, "df_input")

        # Generate output variable name
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        # If no column configs, pass through unchanged
        if not column_configs:
            lines.append(f"{var_name} = {input_var}")
            return (lines, {1: var_name})

        # Build list of expression strings for selected columns
        expr_parts: list[str] = []

        for col_config in column_configs:
            name = col_config.get("name")
            selected = col_config.get("selected", True)
            rename = col_config.get("rename")
            target_type = col_config.get("targetType")
            size = col_config.get("size")

            if not name or not selected:
                continue

            # Build expression string
            escaped_name = PythonCodeGenerator.escape_string(name)
            expr = f'pl.col("{escaped_name}")'

            # Apply type cast if specified
            if target_type and target_type in DTYPE_STRING_TO_POLARS:
                expr = f"{expr}.cast(pl.{target_type})"

            # Apply string truncation if specified
            if size is not None and size > 0:
                if target_type in ("String", "Utf8") or target_type is None:
                    expr = f"{expr}.str.head({size})"

            # Apply rename/alias
            output_name = rename.strip() if rename and rename.strip() else name
            escaped_output = PythonCodeGenerator.escape_string(output_name)
            expr = f'{expr}.alias("{escaped_output}")'

            expr_parts.append(expr)

        if not expr_parts:
            lines.append(f"# ERROR: No columns selected")
            lines.append(f"{var_name} = {input_var}")
            return (lines, {1: var_name})

        # Generate select statement
        if len(expr_parts) == 1:
            lines.append(f"{var_name} = {input_var}.select({expr_parts[0]})")
        else:
            lines.append(f"{var_name} = {input_var}.select([")
            for expr in expr_parts:
                lines.append(f"    {expr},")
            lines.append("])")

        return (lines, {1: var_name})
