"""Unpivot tool implementation - Transform wide format to long format (melt)."""

from typing import Any

import polars as pl

from app.api.models.common import ColumnSchema, DataSchema, PolarsDataType
from app.domain.execution.safety import check_unpivot_safety, raise_if_unsafe
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import UnpivotOperation
from app.domain.tools.registry import register_tool
from app.domain.tools.sockets import CommonSockets
from app.utils.columns import resolve_column_names
from app.utils.errors import ToolError


@register_tool("Unpivot")
class UnpivotTool(BaseTool):
    """
    Transform data from wide format to long format (melt).

    Takes multiple columns and "unpivots" them into rows, creating two new columns:
    - A "variable" column containing the original column names
    - A "value" column containing the values from those columns

    Config:
    - on: list[str] - columns to unpivot (their values become rows)
    - index: list[str] - columns to keep as identifiers (optional)
    - variableName: str - name for the column storing original column names (default: "variable")
    - valueName: str - name for the column storing the values (default: "value")

    Example:
        Input:  id | sales_q1 | sales_q2 | sales_q3
                1  | 100      | 150      | 200

        Output: id | quarter  | sales
                1  | sales_q1 | 100
                1  | sales_q2 | 150
                1  | sales_q3 | 200
    """

    def is_blocking(self, config: dict[str, Any] | None = None) -> bool:
        """Unpivot is not blocking - it's a lazy column reshape."""
        return False

    def _build_operation(self, config: dict[str, Any]) -> UnpivotOperation:
        """Build the unpivot operation from config."""
        on = config.get("on", [])
        index = config.get("index", [])
        variable_name = config.get("variableName", "variable")
        value_name = config.get("valueName", "value")

        # Ensure lists
        if not isinstance(on, list):
            on = [on] if on else []
        if not isinstance(index, list):
            index = [index] if index else []

        return UnpivotOperation(
            on=on,
            index=index,
            variable_name=variable_name or "variable",
            value_name=value_name or "value",
        )

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """Execute unpivot operation."""
        if CommonSockets.INPUT not in inputs:
            raise ToolError("Unpivot tool requires input on socket 'input'")

        input_data = inputs[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Unpivot tool does not support multiple inputs")
        lf: pl.LazyFrame = input_data

        on = config.get("on", [])
        if not on:
            raise ToolError("Unpivot requires at least one column to unpivot (on)")

        # Ensure on is a list
        if not isinstance(on, list):
            on = [on] if on else []

        # Resolve column name casing against actual schema
        available_cols = lf.collect_schema().names()
        resolved_config = dict(config)
        resolved_on = resolve_column_names(on, available_cols, context="Unpivot on")
        if resolved_on != on:
            resolved_config["on"] = resolved_on
            on = resolved_on
        index = config.get("index", [])
        if index:
            idx_list = index if isinstance(index, list) else [index]
            resolved_index = resolve_column_names(idx_list, available_cols, context="Unpivot index")
            resolved_config["index"] = resolved_index
        config = resolved_config

        # Safety check: prevent row explosion
        raise_if_unsafe(check_unpivot_safety(lf, on))

        op = self._build_operation(config)
        result = op.execute(lf)

        return {CommonSockets.OUTPUT: result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Calculate output schema for unpivot.

        Output has:
        - All index columns (preserved)
        - A variable column (String type)
        - A value column (type depends on unpivoted columns)
        """
        if CommonSockets.INPUT not in input_schemas:
            raise ToolError("Unpivot tool requires input schema on socket 'input'")

        input_data = input_schemas[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Unpivot tool does not support multiple input schemas")
        input_schema: DataSchema = input_data

        index = config.get("index", [])
        on = config.get("on", [])
        variable_name = config.get("variableName", "variable") or "variable"
        value_name = config.get("valueName", "value") or "value"

        # Ensure lists
        if not isinstance(index, list):
            index = [index] if index else []
        if not isinstance(on, list):
            on = [on] if on else []

        # Create column lookup
        input_column_map = {col.name: col for col in input_schema.columns}

        output_columns: list[ColumnSchema] = []

        # Add index columns first (preserved)
        for col_name in index:
            if col_name in input_column_map:
                output_columns.append(input_column_map[col_name])

        # Add variable column (always String)
        output_columns.append(
            ColumnSchema(
                name=variable_name,
                dtype=PolarsDataType.STRING,
                nullable=False,
            )
        )

        # Determine value column type
        # If all unpivoted columns have same type, use that; otherwise use String
        value_types = set()
        for col_name in on:
            if col_name in input_column_map:
                value_types.add(input_column_map[col_name].dtype)

        if len(value_types) == 1:
            value_dtype = value_types.pop()
        else:
            # Mixed types - Polars will supertype, but String is safest guess
            value_dtype = PolarsDataType.STRING

        output_columns.append(
            ColumnSchema(
                name=value_name,
                dtype=value_dtype,
                nullable=True,
            )
        )

        return {
            CommonSockets.OUTPUT: DataSchema(
                columns=output_columns,
                row_count=None,  # Row count changes (multiplied by number of unpivoted columns)
                file_size_bytes=None,
            )
        }

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate unpivot configuration."""
        errors: list[str] = []

        on = config.get("on", [])
        if not on:
            errors.append("At least one column must be selected to unpivot")
        elif not isinstance(on, list):
            errors.append("'on' must be a list of column names")

        index = config.get("index", [])
        if index and not isinstance(index, list):
            errors.append("'index' must be a list of column names")

        # Check for overlap between on and index
        if isinstance(on, list) and isinstance(index, list):
            overlap = set(on) & set(index)
            if overlap:
                errors.append(f"Columns cannot be both in 'on' and 'index': {overlap}")

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Unpivot tool."""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        input_var = self._get_input_var(input_vars.get(CommonSockets.INPUT))
        output_var = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        op = self._build_operation(config)
        lines = op.to_code(input_var, output_var)

        return (lines, {CommonSockets.OUTPUT: output_var})
