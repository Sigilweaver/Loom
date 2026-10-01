"""Pivot tool implementation - Transform long format to wide format."""

from typing import Any

import polars as pl
from pydantic import BaseModel, ConfigDict, Field

from app.domain.execution.safety import check_pivot_safety, raise_if_unsafe
from app.domain.models.common import ColumnSchema, DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import PivotOperation
from app.domain.tools.registry import register_tool
from app.domain.tools.sockets import CommonSockets
from app.utils.columns import resolve_column_name, resolve_column_names
from app.utils.errors import ToolError

# Valid aggregation functions for pivot with display labels
PIVOT_AGGREGATIONS = {
    "first": "First",
    "last": "Last",
    "sum": "Sum",
    "mean": "Mean",
    "median": "Median",
    "min": "Min",
    "max": "Max",
    "len": "Count",
}

class PivotToolConfig(BaseModel):
    """Typed config for Pivot."""

    model_config = ConfigDict(extra="allow")

    on: str = Field(default="")
    index: list[str] = Field(default_factory=list)
    values: str = Field(default="")
    aggregateFunction: str = Field(default="first")


@register_tool("Pivot")
class PivotTool(BaseTool):
    """
    Transform data from long format to wide format.

    Takes values from one column and spreads them across multiple columns,
    using values from another column as the new column headers.

    Config:
    - on: str - column whose unique values become new column headers
    - index: list[str] - columns to group by (preserved as row identifiers)
    - values: str - column whose values fill the new columns
    - aggregateFunction: str - how to aggregate when multiple values exist (default: "first")

    Example:
        Input:  id | quarter  | sales
                1  | Q1       | 100
                1  | Q2       | 150
                2  | Q1       | 200

        Output: id | Q1  | Q2
                1  | 100 | 150
                2  | 200 | null
    """

    def is_blocking(self, config: dict[str, Any] | None = None) -> bool:
        """Pivot is blocking - must scan all data to determine unique values and aggregate."""
        return True

    def should_cache(self, config: dict[str, Any]) -> bool:
        """Cache results since operation is blocking."""
        return True

    @classmethod
    def config_model(cls) -> type[PivotToolConfig]:
        return PivotToolConfig

    def cache_keys(self, config: dict[str, Any]) -> dict[str, Any]:
        return {
            "on": config.get("on", ""),
            "index": config.get("index", []),
            "values": config.get("values", ""),
            "aggregateFunction": config.get("aggregateFunction", "first"),
        }

    def _build_operation(self, config: dict[str, Any]) -> PivotOperation:
        """Build the pivot operation from config."""
        on = config.get("on", "")
        index = config.get("index", [])
        values = config.get("values", "")
        aggregate_function = config.get("aggregateFunction", "first")

        # Ensure index is a list
        if not isinstance(index, list):
            index = [index] if index else []

        # Validate aggregate function
        if aggregate_function not in PIVOT_AGGREGATIONS:
            aggregate_function = "first"

        return PivotOperation(
            on=on,
            index=index,
            values=values,
            aggregate_function=aggregate_function,
        )

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """Execute pivot operation."""
        if CommonSockets.INPUT not in inputs:
            raise ToolError(
                "Pivot tool has no input connected. Connect an upstream tool to its 'input' socket."
            )

        input_data = inputs[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError(
                "Pivot tool accepts a single input, but several are connected. Combine them "
                "first, for example with a Union tool."
            )
        lf: pl.LazyFrame = input_data

        on = config.get("on", "")
        values = config.get("values", "")

        if not on:
            raise ToolError("Pivot requires a column to pivot on")
        if not values:
            raise ToolError("Pivot requires a values column")

        # Resolve column name casing against actual schema
        available_cols = lf.collect_schema().names()
        resolved_config = dict(config)
        resolved_on = resolve_column_name(on, available_cols, context="Pivot on")
        resolved_values = resolve_column_name(values, available_cols, context="Pivot values")
        if resolved_on != on or resolved_values != values:
            resolved_config["on"] = resolved_on
            resolved_config["values"] = resolved_values
            on = resolved_on
        index = config.get("index", [])
        if index:
            resolved_index = resolve_column_names(
                index if isinstance(index, list) else [index],
                available_cols,
                context="Pivot index",
            )
            resolved_config["index"] = resolved_index
        config = resolved_config

        # Safety check: prevent creating too many columns
        raise_if_unsafe(check_pivot_safety(lf, on))

        op = self._build_operation(config)
        result = op.execute(lf)

        return {CommonSockets.OUTPUT: result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Calculate output schema for pivot.

        Note: We cannot determine exact output columns without executing the pivot
        (since we don't know the unique values in the 'on' column). We return
        the index columns with a note that additional columns will be created.
        """
        if CommonSockets.INPUT not in input_schemas:
            raise ToolError(
                "Pivot tool requires input schema on socket 'input'. Connect an upstream tool to "
                "its 'input' socket."
            )

        input_data = input_schemas[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError(
                "Pivot tool accepts a single input, but several are connected. Combine them "
                "first, for example with a Union tool."
            )
        input_schema: DataSchema = input_data

        index = config.get("index", [])
        values = config.get("values", "")

        # Ensure index is a list
        if not isinstance(index, list):
            index = [index] if index else []

        # Create column lookup
        input_column_map = {col.name: col for col in input_schema.columns}

        output_columns: list[ColumnSchema] = []

        # Add index columns (preserved)
        for col_name in index:
            if col_name in input_column_map:
                output_columns.append(input_column_map[col_name])

        # We can't know the pivoted column names without data, but we know their type
        # The type comes from the values column (or aggregation result type)
        if values and values in input_column_map:
            # Add a placeholder note - actual columns depend on data
            # This is a limitation - pivot output schema requires data knowledge
            pass

        return {
            CommonSockets.OUTPUT: DataSchema(
                columns=output_columns,
                row_count=None,  # Row count depends on unique index combinations
                file_size_bytes=None,
            )
        }

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate pivot configuration."""
        errors: list[str] = []

        on = config.get("on", "")
        if not on:
            errors.append("A column must be selected to pivot on (creates new column headers)")

        values = config.get("values", "")
        if not values:
            errors.append("A values column must be selected (fills the new columns)")

        index = config.get("index", [])
        if not isinstance(index, list):
            index = [index] if index else []

        # Index is required for pivot - Polars requires at least one grouping key
        if not index:
            errors.append("At least one index column must be selected (determines row grouping)")

        # Check for overlap
        all_cols = set(index)
        if on:
            if on in all_cols:
                errors.append(f"Column '{on}' cannot be both in index and pivot on")
            all_cols.add(on)
        if values:
            if values in all_cols:
                errors.append(
                    f"Column '{values}' cannot be used as both values and index/pivot column"
                )

        aggregate_function = config.get("aggregateFunction", "first")
        if aggregate_function not in PIVOT_AGGREGATIONS:
            errors.append(
                f"Invalid aggregate function: '{aggregate_function}'. "
                f"Must be one of: {', '.join(sorted(PIVOT_AGGREGATIONS.keys()))}"
            )

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Pivot tool."""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        input_var = self._get_input_var(input_vars.get(CommonSockets.INPUT))
        output_var = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        op = self._build_operation(config)
        lines = op.to_code(input_var, output_var)

        return (lines, {CommonSockets.OUTPUT: output_var})
