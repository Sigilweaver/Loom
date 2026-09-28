"""Sort tool implementation - Sort data by one or more columns"""

from typing import Any, Literal

import polars as pl
from pydantic import BaseModel, ConfigDict, Field

from app.domain.models.common import DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import SortColumn, SortOperation
from app.domain.tools.registry import register_tool
from app.domain.tools.sockets import CommonSockets
from app.utils.columns import resolve_column_name
from app.utils.errors import ToolError

# Valid sort directions
SORT_DIRECTIONS = {"asc", "desc"}


class SortColumnConfig(BaseModel):
    """Single sort-column definition. Typed-config exemplar.

    Unknown keys are rejected (`extra="forbid"`) so config drift surfaces as a
    validation error rather than being silently dropped: an AI-generated config
    using `order: "descending"` instead of `direction: "desc"` previously
    produced a silent ascending sort.
    """

    model_config = ConfigDict(extra="forbid")

    column: str = Field(..., min_length=1, description="Column to sort by.")
    direction: Literal["asc", "desc"] = Field(
        default="asc", description="Sort direction."
    )
    nullsFirst: bool = Field(default=False, description="Place nulls first.")


class SortToolConfig(BaseModel):
    """Top-level Sort tool config. Typed-config exemplar."""

    model_config = ConfigDict(extra="forbid")

    sortColumns: list[SortColumnConfig] = Field(default_factory=list)


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

    def is_blocking(self, config: dict[str, Any] | None = None) -> bool:
        """Sort is blocking - must see all rows to determine order."""
        return True

    @classmethod
    def config_model(cls) -> type[SortToolConfig]:
        """Expose typed Pydantic config model."""
        return SortToolConfig

    def cache_keys(self, config: dict[str, Any]) -> dict[str, Any]:
        """Only sortColumns affect output; ignore unrelated fields."""
        return {"sortColumns": config.get("sortColumns", [])}

    def _build_operation(self, config: dict[str, Any]) -> SortOperation:
        """Build the sort operation from config."""
        sort_columns = config.get("sortColumns", [])
        columns = []
        for sort_col in sort_columns:
            column = sort_col.get("column")
            if not column:
                continue
            direction = sort_col.get("direction", "asc")
            nulls_first = sort_col.get("nullsFirst", False)
            columns.append(
                SortColumn(
                    column=column,
                    descending=(direction == "desc"),
                    nulls_last=(not nulls_first),
                )
            )
        return SortOperation(columns=columns)

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """
        Execute sort operation.
        """
        if CommonSockets.INPUT not in inputs:
            raise ToolError("Sort tool requires input on socket 'input'")

        input_data = inputs[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Sort tool does not support multiple inputs")
        lf: pl.LazyFrame = input_data

        # Resolve column names case-insensitively against actual schema
        sort_columns = config.get("sortColumns", [])
        if sort_columns:
            available_cols = lf.collect_schema().names()
            resolved_config = dict(config)
            resolved_sorts: list[dict[str, Any]] = []
            for sort_col in sort_columns:
                resolved_sort = dict(sort_col)
                col = sort_col.get("column")
                if col:
                    resolved_sort["column"] = resolve_column_name(
                        col, available_cols, context="Sort"
                    )
                resolved_sorts.append(resolved_sort)
            resolved_config["sortColumns"] = resolved_sorts
            op = self._build_operation(resolved_config)
        else:
            op = self._build_operation(config)

        result = op.execute(lf)

        return {CommonSockets.OUTPUT: result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Sort preserves the input schema exactly.
        """
        if CommonSockets.INPUT not in input_schemas:
            raise ToolError("Sort tool requires input schema on socket 'input'")

        input_data = input_schemas[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Sort tool does not support multiple input schemas")
        input_schema: DataSchema = input_data

        # Sort doesn't change the schema, just the row order
        return {CommonSockets.OUTPUT: input_schema}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate sort configuration.

        Runs the typed config model first so unknown/drifted keys (e.g.
        `order` instead of `direction`) are rejected rather than silently
        dropped, then adds Sort-specific friendly messages.
        """
        errors: list[str] = []

        # Reject unknown/drifted keys against the typed contract. Doing this
        # explicitly (rather than a full model_validate) avoids duplicating the
        # friendly per-column messages below. This is what catches an
        # AI-generated `order: "descending"` instead of `direction: "desc"`.
        allowed_top = set(SortToolConfig.model_fields)
        for key in config:
            if key not in allowed_top:
                errors.append(f"Unknown config key: '{key}'")

        sort_columns = config.get("sortColumns", [])

        # Empty sort columns is valid (pass-through)
        if not sort_columns:
            return errors

        allowed_col = set(SortColumnConfig.model_fields)
        seen_columns: set[str] = set()

        for i, sort_col in enumerate(sort_columns):
            if not isinstance(sort_col, dict):
                errors.append(f"Sort column at index {i} must be an object")
                continue

            for key in sort_col:
                if key not in allowed_col:
                    errors.append(f"Sort column at index {i} has unknown key: '{key}'")

            column = sort_col.get("column")
            direction = sort_col.get("direction", "asc")

            if not column:
                errors.append(f"Sort column at index {i} is missing 'column'")
                continue

            if direction not in SORT_DIRECTIONS:
                errors.append(
                    f"Invalid sort direction at index {i}: '{direction}'. Must be 'asc' or 'desc'"
                )

            # Check for duplicate columns
            if column in seen_columns:
                errors.append(f"Duplicate sort column: '{column}'")
            seen_columns.add(column)

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Sort tool - uses same operation as execute()"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        input_var = self._get_input_var(input_vars.get(CommonSockets.INPUT))
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        # Use the same operation builder as execute()
        op = self._build_operation(config)
        lines = op.to_code(input_var, var_name)

        return (lines, {CommonSockets.OUTPUT: var_name})
