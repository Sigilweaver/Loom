"""Select tool implementation - Select, rename, reorder, and cast columns"""

from typing import Any

import polars as pl

from app.api.models.common import ColumnSchema, DataSchema, PolarsDataType
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import SelectOperation, build_select_expr
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError

# Mapping from PolarsDataType string to actual Polars type for casting
# Note: These are type classes (like pl.Int8), not instances
DTYPE_STRING_TO_POLARS: dict[str, type[pl.DataType]] = {
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

    def _build_operation(self, config: dict[str, Any]) -> SelectOperation:
        """Build the select operation from config."""
        column_configs = config.get("columnConfigs", [])
        expressions = []
        for col_config in column_configs:
            expr = build_select_expr(col_config)
            if expr is not None:
                expressions.append(expr)
        return SelectOperation(expressions=expressions)

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """
        Execute column selection, renaming, reordering, and type casting.

        Config should contain:
        - columnConfigs: list[dict] - column configurations
        """
        if "input" not in inputs:
            raise ToolError("Select tool requires input on socket 'input'")

        input_data = inputs["input"]
        if isinstance(input_data, list):
            raise ToolError("Select tool does not support multiple inputs")
        lf: pl.LazyFrame = input_data

        column_configs = config.get("columnConfigs", [])

        # If no column configs, pass through unchanged
        if not column_configs:
            return {"output": lf}

        op = self._build_operation(config)

        if not op.expressions:
            raise ToolError("At least one column must be selected")

        result = op.execute(lf)
        return {"output": result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Calculate output schema based on column configuration.
        """
        if "input" not in input_schemas:
            raise ToolError("Select tool requires input schema on socket 'input'")

        input_data = input_schemas["input"]
        if isinstance(input_data, list):
            raise ToolError("Select tool does not support multiple input schemas")
        input_schema: DataSchema = input_data

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
        errors: list[str] = []

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
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Select tool - uses same operation as execute()"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        column_configs = config.get("columnConfigs", [])
        input_var = self._get_input_var(input_vars.get("input"))
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        # If no column configs, pass through unchanged
        if not column_configs:
            return ([f"{var_name} = {input_var}"], {"output": var_name})

        # Use the same operation builder as execute()
        op = self._build_operation(config)

        if not op.expressions:
            return (
                ["# ERROR: No columns selected", f"{var_name} = {input_var}"],
                {"output": var_name},
            )

        lines = op.to_code(input_var, var_name)
        return (lines, {"output": var_name})
