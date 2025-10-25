"""Select tool implementation - Select or drop columns"""

from typing import Any

import polars as pl

from app.api.models.common import DataSchema, ColumnSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError


@register_tool("Select")
class SelectTool(BaseTool):
    """
    Select or drop columns from DataFrame.

    Config:
    - columns: list of column names
    - exclude_mode: if true, drop these columns; if false, keep only these columns
    """

    async def execute(
        self, config: dict[str, Any], inputs: dict[int, pl.LazyFrame]
    ) -> dict[int, pl.LazyFrame]:
        """
        Select or drop columns.

        Config should contain:
        - columns: list[str] - column names
        - exclude_mode: bool - if true, drop columns; if false, keep columns
        """
        # Get input LazyFrame
        if 0 not in inputs:
            raise ToolError("Select tool requires input on socket 0")

        lf = inputs[0]

        # Get configuration
        columns = config.get("columns", [])
        exclude_mode = config.get("exclude_mode", False)

        if not columns:
            # No columns specified - return input unchanged
            return {1: lf}

        # Apply selection
        if exclude_mode:
            # Drop specified columns
            lf = lf.drop(columns)
        else:
            # Keep only specified columns
            lf = lf.select(columns)

        return {1: lf}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[int, DataSchema]
    ) -> dict[int, DataSchema]:
        """
        Calculate output schema based on column selection.
        """
        if 0 not in input_schemas:
            raise ToolError("Select tool requires input schema on socket 0")

        input_schema = input_schemas[0]
        columns = config.get("columns", [])
        exclude_mode = config.get("exclude_mode", False)

        if not columns:
            # No selection - schema unchanged
            return {1: input_schema}

        # Calculate output columns
        if exclude_mode:
            # Remove specified columns
            output_columns = [
                col for col in input_schema.columns if col.name not in columns
            ]
        else:
            # Keep only specified columns
            output_columns = [
                col for col in input_schema.columns if col.name in columns
            ]

        # Create output schema
        output_schema = DataSchema(
            columns=output_columns,
            row_count=input_schema.row_count,  # Row count unchanged
            file_size_bytes=None,  # Size changes but we don't calculate
        )

        return {1: output_schema}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate select configuration"""
        errors = []

        columns = config.get("columns")
        if columns is None:
            errors.append("Missing required field: columns")
        elif not isinstance(columns, list):
            errors.append("Field 'columns' must be a list")
        elif len(columns) == 0:
            errors.append("Field 'columns' cannot be empty")

        return errors
