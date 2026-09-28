"""Summarize tool implementation - Group by and aggregate data"""

from typing import Any

import polars as pl
from pydantic import BaseModel, ConfigDict, Field

from app.domain.models.common import ColumnSchema, DataSchema, PolarsDataType
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import AggregationExpr, SummarizeOperation
from app.domain.tools.registry import register_tool
from app.domain.tools.sockets import CommonSockets
from app.utils.columns import resolve_column_name
from app.utils.errors import ToolError

# Valid aggregation operations with their Polars methods
AGGREGATION_OPERATIONS = {
    # Numeric aggregations
    "Sum": "sum",
    "Mean": "mean",
    "Median": "median",
    "Min": "min",
    "Max": "max",
    "Std": "std",
    "Var": "var",
    # Count aggregations (work on any type)
    "Count": "count",
    "CountDistinct": "n_unique",
    # String aggregations
    "First": "first",
    "Last": "last",
    "Concat": "str.concat",
}


class SummarizeAggregationConfig(BaseModel):
    """Single aggregation. Typed config."""

    model_config = ConfigDict(extra="allow")

    column: str | None = None
    operation: str | None = None
    outputName: str | None = None


class SummarizeToolConfig(BaseModel):
    """Typed config for Summarize."""

    model_config = ConfigDict(extra="allow")

    # groupByColumns supports legacy string entries and object entries.
    groupByColumns: list[Any] = Field(default_factory=list)
    aggregations: list[SummarizeAggregationConfig] = Field(default_factory=list)
    includeNulls: bool = False


def get_result_dtype(operation: str, input_dtype: PolarsDataType) -> PolarsDataType:
    """Determine the output dtype for an aggregation operation"""
    if operation in {"Count", "CountDistinct"}:
        return PolarsDataType.UINT32
    elif operation in {"Mean", "Std", "Var", "Median"}:
        return PolarsDataType.FLOAT64
    elif operation == "Concat":
        return PolarsDataType.STRING
    else:
        # Sum, Min, Max, First, Last preserve type
        return input_dtype


@register_tool("Summarize")
class SummarizeTool(BaseTool):
    """
    Summarize data with group by and aggregations.

    Config:
    - groupByColumns: list[str] - columns to group by (can be empty for global aggregation)
    - aggregations: list[dict] - aggregation definitions
      Each dict contains:
        - column: str - column to aggregate
        - operation: str - aggregation operation (Sum, Mean, Count, etc.)
        - outputName: str - name for the output column (optional)
    - includeNulls: bool - whether to include null values in grouping (default: False)
    """

    def is_blocking(self, config: dict[str, Any] | None = None) -> bool:
        """Summarize is blocking - must see all rows per group."""
        return True

    @classmethod
    def config_model(cls) -> type["SummarizeToolConfig"]:
        return SummarizeToolConfig

    def cache_keys(self, config: dict[str, Any]) -> dict[str, Any]:
        return {
            "groupByColumns": config.get("groupByColumns", []),
            "aggregations": config.get("aggregations", []),
            "includeNulls": config.get("includeNulls", False),
        }

    def _build_operation(self, config: dict[str, Any]) -> SummarizeOperation:
        """Build the summarize operation from config."""
        group_by_config = config.get("groupByColumns", [])
        aggregations_config = config.get("aggregations", [])

        # Parse group by columns - supports both legacy string format and new object format
        group_by_columns = []
        for item in group_by_config:
            if isinstance(item, str):
                # Legacy format: plain string
                group_by_columns.append(item)
            elif isinstance(item, dict):
                # New format: object with _id and column
                column = item.get("column")
                if column:
                    group_by_columns.append(column)

        aggregations = []
        for agg in aggregations_config:
            column = agg.get("column")
            operation = agg.get("operation", "Sum")
            output_name = agg.get("outputName", "")
            if column:
                aggregations.append(
                    AggregationExpr(
                        column=column,
                        operation=operation,
                        output_name=output_name,
                    )
                )

        return SummarizeOperation(
            group_by_columns=group_by_columns,
            aggregations=aggregations,
        )

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """
        Execute summarize operation with group by and aggregations.

        If aggregations is empty but groupByColumns is provided, returns distinct
        values for those columns (like SQL SELECT DISTINCT).
        """
        if CommonSockets.INPUT not in inputs:
            raise ToolError("Summarize tool requires input on socket 'input'")

        input_data = inputs[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Summarize tool does not support multiple inputs")
        lf: pl.LazyFrame = input_data

        group_by_config = config.get("groupByColumns", [])
        aggregations = config.get("aggregations", [])

        # Parse group by columns for validation
        group_by_columns = []
        for item in group_by_config:
            if isinstance(item, str):
                group_by_columns.append(item)
            elif isinstance(item, dict):
                column = item.get("column")
                if column:
                    group_by_columns.append(column)

        # Handle no aggregations and no group by
        if not aggregations and not group_by_columns:
            raise ToolError("Either group by columns or aggregations are required")

        # Resolve column names case-insensitively against the actual schema.
        # This prevents hard failures when the AI agent guesses casing wrong
        # (e.g. "Sex" instead of "sex").
        available_cols = lf.collect_schema().names()

        # Fix group-by column names in the config copy
        resolved_config = dict(config)
        if group_by_columns:
            resolved_gb: list[str | dict[str, Any]] = []
            for item in group_by_config:
                if isinstance(item, str):
                    resolved_gb.append(
                        resolve_column_name(item, available_cols, context="Summarize groupBy")
                    )
                elif isinstance(item, dict):
                    col = item.get("column")
                    if col:
                        resolved_item = dict(item)
                        resolved_item["column"] = resolve_column_name(
                            col, available_cols, context="Summarize groupBy"
                        )
                        resolved_gb.append(resolved_item)
                    else:
                        resolved_gb.append(item)
            resolved_config["groupByColumns"] = resolved_gb

        # Fix aggregation column names
        if aggregations:
            resolved_aggs: list[dict[str, Any]] = []
            for agg in aggregations:
                resolved_agg = dict(agg)
                col = agg.get("column")
                if col:
                    resolved_agg["column"] = resolve_column_name(
                        col, available_cols, context="Summarize aggregation"
                    )
                resolved_aggs.append(resolved_agg)
            resolved_config["aggregations"] = resolved_aggs

        op = self._build_operation(resolved_config)
        result = op.execute(lf)

        return {CommonSockets.OUTPUT: result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Calculate output schema based on group by and aggregation configuration.
        """
        if CommonSockets.INPUT not in input_schemas:
            raise ToolError("Summarize tool requires input schema on socket 'input'")

        input_data = input_schemas[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Summarize tool does not support multiple input schemas")
        input_schema: DataSchema = input_data
        group_by_config = config.get("groupByColumns", [])
        aggregations = config.get("aggregations", [])

        # Parse group by columns - supports both legacy string format and new object format
        group_by_columns = []
        for item in group_by_config:
            if isinstance(item, str):
                group_by_columns.append(item)
            elif isinstance(item, dict):
                column = item.get("column")
                if column:
                    group_by_columns.append(column)

        # Create lookup for input column schemas
        input_column_map = {col.name: col for col in input_schema.columns}

        output_columns: list[ColumnSchema] = []

        # Add group by columns first (preserve their types)
        for col_name in group_by_columns:
            if col_name in input_column_map:
                output_columns.append(input_column_map[col_name])

        # Add aggregation columns
        for agg in aggregations:
            column = agg.get("column")
            operation = agg.get("operation", "Sum")
            output_name = agg.get("outputName", "")

            if not column or column not in input_column_map:
                continue

            input_col = input_column_map[column]
            input_dtype = input_col.dtype

            # Determine output name
            default_name = f"{column}_{operation}"
            col_name = output_name.strip() if output_name and output_name.strip() else default_name

            # Determine output dtype
            output_dtype = get_result_dtype(operation, input_dtype)

            output_columns.append(
                ColumnSchema(
                    name=col_name,
                    dtype=output_dtype,
                    nullable=True,  # Aggregations can produce nulls (e.g., empty groups)
                )
            )

        return {
            CommonSockets.OUTPUT: DataSchema(
                columns=output_columns,
                row_count=None,  # Row count depends on number of groups
                file_size_bytes=None,
            )
        }

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate summarize configuration"""
        errors = []

        aggregations = config.get("aggregations", [])
        group_by_config = config.get("groupByColumns", [])

        # Parse group by columns - supports both legacy string format and new object format
        group_by_columns = []
        for item in group_by_config:
            if isinstance(item, str):
                group_by_columns.append(item)
            elif isinstance(item, dict):
                column = item.get("column")
                if column:
                    group_by_columns.append(column)

        # Allow empty aggregations if group by columns are provided (distinct values case)
        if not aggregations:
            if not group_by_columns:
                errors.append("Either group by columns or aggregations are required")
            return errors

        seen_output_names: set[str] = set()
        group_by_columns_set = set(group_by_columns)

        for i, agg in enumerate(aggregations):
            if not isinstance(agg, dict):
                errors.append(f"Aggregation at index {i} must be an object")
                continue

            column = agg.get("column")
            operation = agg.get("operation")
            output_name = agg.get("outputName", "")

            if not column:
                errors.append(f"Aggregation at index {i} is missing 'column'")
                continue

            if not operation:
                errors.append(f"Aggregation at index {i} is missing 'operation'")
                continue

            if operation not in AGGREGATION_OPERATIONS:
                errors.append(f"Unknown aggregation operation: '{operation}'")

            # Check for duplicate output names
            default_name = f"{column}_{operation}"
            out_name = output_name.strip() if output_name else ""
            final_name = out_name if out_name else default_name
            if final_name in seen_output_names:
                errors.append(f"Duplicate output column name: '{final_name}'")
            if final_name in group_by_columns_set:
                errors.append(f"Output column '{final_name}' conflicts with group by column")
            seen_output_names.add(final_name)

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Summarize tool - uses same operation as execute()"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        input_var = self._get_input_var(input_vars.get(CommonSockets.INPUT))
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        # Use the same operation builder as execute()
        op = self._build_operation(config)
        lines = op.to_code(input_var, var_name)

        return (lines, {CommonSockets.OUTPUT: var_name})
