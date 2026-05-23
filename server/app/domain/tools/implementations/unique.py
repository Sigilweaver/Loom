"""Unique tool implementation - Split data into unique and duplicate rows."""

from typing import Any, Literal

import polars as pl
from pydantic import BaseModel, ConfigDict, Field

from app.api.models.common import DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import UniqueOperation
from app.domain.tools.registry import register_tool
from app.domain.tools.sockets import UniqueSockets
from app.utils.columns import resolve_column_names
from app.utils.errors import ToolError

# Valid unique modes
UNIQUE_MODES = {"First", "Strict"}


class UniqueToolConfig(BaseModel):
    """WP-19 typed config for Unique."""

    model_config = ConfigDict(extra="allow")

    columns: list[str] = Field(default_factory=list)
    mode: Literal["First", "Strict"] = "First"


@register_tool("Unique")
class UniqueTool(BaseTool):
    """
    Split data into unique and duplicate rows.

    Outputs:
    - output-unique (U): Rows considered "unique" based on mode
    - output-duplicate (D): Rows considered "duplicates" based on mode

    Modes:
    - First (default): Unique = first occurrence of each value,
                                       Duplicate = subsequent occurrences
    - Strict: Unique = ONLY values appearing exactly once,
              Duplicate = ALL rows where value appears more than once

    Config:
    - columns: list[str] - columns to check for duplicates (empty = all columns)
    - mode: str - "First" or "Strict" (default: "First")
    """

    def is_blocking(self, config: dict[str, Any] | None = None) -> bool:
        """
        Unique is always blocking - must track seen values across all rows.

        Both modes require a full data scan:
        - First: needs hash set of seen values
        - Strict: needs value counts across entire dataset
        """
        return True

    def should_cache(self, config: dict[str, Any]) -> bool:
        """Cache results since operation is blocking."""
        return True

    @classmethod
    def config_model(cls) -> type[UniqueToolConfig]:
        return UniqueToolConfig

    def cache_keys(self, config: dict[str, Any]) -> dict[str, Any]:
        return {
            "columns": config.get("columns", []),
            "mode": config.get("mode", "First"),
        }

    def _build_operation(self, config: dict[str, Any]) -> UniqueOperation:
        """Build the unique operation from config."""
        columns = config.get("columns", [])
        mode = config.get("mode", "First")

        # Validate mode
        if mode not in UNIQUE_MODES:
            mode = "First"

        # Ensure columns is a list
        if not isinstance(columns, list):
            columns = []

        return UniqueOperation(columns=columns, mode=mode)

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """Execute unique operation, splitting into unique and duplicate outputs."""
        if UniqueSockets.INPUT not in inputs:
            raise ToolError("Unique tool requires input on socket 'input'")

        input_data = inputs[UniqueSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Unique tool does not support multiple inputs")
        lf: pl.LazyFrame = input_data

        # Resolve column name casing against actual schema
        columns = config.get("columns", [])
        if columns and isinstance(columns, list):
            available_cols = lf.collect_schema().names()
            resolved_cols = resolve_column_names(columns, available_cols, context="Unique")
            if resolved_cols != columns:
                config = {**config, "columns": resolved_cols}

        op = self._build_operation(config)
        unique_output, duplicate_output = op.execute(lf)

        return {
            UniqueSockets.OUTPUT_UNIQUE: unique_output,
            UniqueSockets.OUTPUT_DUPLICATE: duplicate_output,
        }

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Output schema is same as input schema for both outputs.

        Unique doesn't change schema, just splits rows.
        """
        if UniqueSockets.INPUT not in input_schemas:
            raise ToolError("Unique tool requires input schema on socket 'input'")

        input_data = input_schemas[UniqueSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Unique tool does not support multiple input schemas")
        input_schema: DataSchema = input_data

        return {
            UniqueSockets.OUTPUT_UNIQUE: input_schema,
            UniqueSockets.OUTPUT_DUPLICATE: input_schema,
        }

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate unique configuration."""
        errors: list[str] = []

        mode = config.get("mode", "First")
        if mode not in UNIQUE_MODES:
            errors.append(
                f"Invalid unique mode: '{mode}'. Must be one of: {', '.join(sorted(UNIQUE_MODES))}"
            )

        columns = config.get("columns", [])
        if not isinstance(columns, list):
            errors.append("Columns must be a list")
        elif any(not isinstance(c, str) for c in columns):
            errors.append("All column names must be strings")

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Unique tool."""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        input_var = self._get_input_var(input_vars.get(UniqueSockets.INPUT))
        var_unique = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}_unique"
        var_duplicate = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}_dupe"

        # Use the same operation builder as execute()
        op = self._build_operation(config)
        lines = op.to_code(input_var, var_unique, var_duplicate)

        return (
            lines,
            {
                UniqueSockets.OUTPUT_UNIQUE: var_unique,
                UniqueSockets.OUTPUT_DUPLICATE: var_duplicate,
            },
        )
