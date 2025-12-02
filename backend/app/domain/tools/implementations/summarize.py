"""Summarize tool implementation - Group by and aggregate data"""

from typing import Any

import polars as pl

from app.api.models.common import ColumnSchema, DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import AggregationExpr, SummarizeOperation
from app.domain.tools.registry import register_tool
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

# Aggregations that work on numeric columns only
NUMERIC_ONLY_AGGREGATIONS = {"Sum", "Mean", "Median", "Std", "Var"}

# Aggregations that work on string columns
STRING_AGGREGATIONS = {"First", "Last", "Concat", "Count", "CountDistinct", "Min", "Max"}

# Aggregations that work on any column type
UNIVERSAL_AGGREGATIONS = {"Count", "CountDistinct", "First", "Last", "Min", "Max"}


def is_numeric_dtype(dtype: str) -> bool:
    """Check if a dtype string represents a numeric type"""
    numeric_types = {
        "Int8", "Int16", "Int32", "Int64",
        "UInt8", "UInt16", "UInt32", "UInt64",
        "Float32", "Float64",
        "Decimal",
    }
    return dtype in numeric_types


def get_result_dtype(operation: str, input_dtype: str) -> str:
    """Determine the output dtype for an aggregation operation"""
    if operation in {"Count", "CountDistinct"}:
        return "UInt32"
    elif operation in {"Mean", "Std", "Var", "Median"}:
        return "Float64"
    elif operation == "Concat":
        return "String"
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

    def _build_operation(self, config: dict[str, Any]) -> SummarizeOperation:
        """Build the summarize operation from config."""
        group_by_columns = config.get("groupByColumns", [])
        aggregations_config = config.get("aggregations", [])

        aggregations = []
        for agg in aggregations_config:
            column = agg.get("column")
            operation = agg.get("operation", "Sum")
            output_name = agg.get("outputName", "")
            if column:
                aggregations.append(AggregationExpr(
                    column=column,
                    operation=operation,
                    output_name=output_name,
                ))

        return SummarizeOperation(
            group_by_columns=group_by_columns,
            aggregations=aggregations,
        )

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame]
    ) -> dict[str, pl.LazyFrame]:
        """
        Execute summarize operation with group by and aggregations.
        
        If aggregations is empty but groupByColumns is provided, returns distinct
        values for those columns (like SQL SELECT DISTINCT).
        """
        if "input" not in inputs:
            raise ToolError("Summarize tool requires input on socket 'input'")

        lf = inputs["input"]

        group_by_columns = config.get("groupByColumns", [])
        aggregations = config.get("aggregations", [])

        # Handle no aggregations and no group by
        if not aggregations and not group_by_columns:
            raise ToolError("Either group by columns or aggregations are required")

        op = self._build_operation(config)
        result = op.execute(lf)

        return {"output": result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema]
    ) -> dict[str, DataSchema]:
        """
        Calculate output schema based on group by and aggregation configuration.
        """
        if "input" not in input_schemas:
            raise ToolError("Summarize tool requires input schema on socket 'input'")

        input_schema = input_schemas["input"]
        group_by_columns = config.get("groupByColumns", [])
        aggregations = config.get("aggregations", [])

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
            col_name = output_name.strip() if output_name and output_name.strip() else f"{column}_{operation}"

            # Determine output dtype
            output_dtype = get_result_dtype(operation, input_dtype)

            output_columns.append(ColumnSchema(
                name=col_name,
                dtype=output_dtype,
                nullable=True,  # Aggregations can produce nulls (e.g., empty groups)
            ))

        return {"output": DataSchema(
            columns=output_columns,
            row_count=None,  # Row count depends on number of groups
            file_size_bytes=None,
        )}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate summarize configuration"""
        errors = []

        aggregations = config.get("aggregations", [])
        group_by_columns = config.get("groupByColumns", [])

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
            final_name = output_name.strip() if output_name and output_name.strip() else f"{column}_{operation}"
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
        input_vars: dict[str, str],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Summarize tool - uses same operation as execute()"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        input_var = input_vars.get("input", "df_input")
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        # Use the same operation builder as execute()
        op = self._build_operation(config)
        lines = op.to_code(input_var, var_name)

        return (lines, {"output": var_name})
