"""Summarize tool implementation - Group by and aggregate data"""

from typing import Any

import polars as pl

from app.api.models.common import DataSchema, ColumnSchema
from app.domain.tools.base import BaseTool
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
    - groupByFields: list[str] - columns to group by (can be empty for global aggregation)
    - aggregations: list[dict] - aggregation definitions
      Each dict contains:
        - field: str - column to aggregate
        - operation: str - aggregation operation (Sum, Mean, Count, etc.)
        - outputName: str - name for the output column (optional)
    - includeNulls: bool - whether to include null values in grouping (default: False)
    """

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame]
    ) -> dict[str, pl.LazyFrame]:
        """
        Execute summarize operation with group by and aggregations.
        """
        # Get input LazyFrame
        if "input" not in inputs:
            raise ToolError("Summarize tool requires input on socket 'input'")

        lf = inputs["input"]
        
        group_by_fields = config.get("groupByFields", [])
        aggregations = config.get("aggregations", [])
        
        if not aggregations:
            raise ToolError("At least one aggregation is required")

        # Build aggregation expressions
        agg_exprs: list[pl.Expr] = []
        
        for agg in aggregations:
            field = agg.get("field")
            operation = agg.get("operation", "Sum")
            output_name = agg.get("outputName", "")
            
            if not field:
                raise ToolError("Aggregation field is required")
            
            if operation not in AGGREGATION_OPERATIONS:
                raise ToolError(f"Unknown aggregation operation: {operation}")

            # Build the expression
            expr = pl.col(field)
            
            # Apply the aggregation method
            if operation == "Sum":
                expr = expr.sum()
            elif operation == "Mean":
                expr = expr.mean()
            elif operation == "Median":
                expr = expr.median()
            elif operation == "Min":
                expr = expr.min()
            elif operation == "Max":
                expr = expr.max()
            elif operation == "Std":
                expr = expr.std()
            elif operation == "Var":
                expr = expr.var()
            elif operation == "Count":
                expr = expr.count()
            elif operation == "CountDistinct":
                expr = expr.n_unique()
            elif operation == "First":
                expr = expr.first()
            elif operation == "Last":
                expr = expr.last()
            elif operation == "Concat":
                expr = expr.str.concat(delimiter=", ")

            # Apply output name alias
            if output_name and output_name.strip():
                expr = expr.alias(output_name.strip())
            else:
                # Default name: field_operation
                expr = expr.alias(f"{field}_{operation}")

            agg_exprs.append(expr)

        # Apply group by or global aggregation
        if group_by_fields:
            result = lf.group_by(group_by_fields).agg(agg_exprs)
        else:
            # Global aggregation (no group by)
            result = lf.select(agg_exprs)

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
        group_by_fields = config.get("groupByFields", [])
        aggregations = config.get("aggregations", [])

        # Create lookup for input column schemas
        input_column_map = {col.name: col for col in input_schema.columns}
        
        output_columns: list[ColumnSchema] = []

        # Add group by columns first (preserve their types)
        for field in group_by_fields:
            if field in input_column_map:
                output_columns.append(input_column_map[field])

        # Add aggregation columns
        for agg in aggregations:
            field = agg.get("field")
            operation = agg.get("operation", "Sum")
            output_name = agg.get("outputName", "")

            if not field or field not in input_column_map:
                continue

            input_col = input_column_map[field]
            input_dtype = input_col.dtype
            
            # Determine output name
            col_name = output_name.strip() if output_name and output_name.strip() else f"{field}_{operation}"
            
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
        
        if not aggregations:
            errors.append("At least one aggregation is required")
            return errors

        seen_output_names: set[str] = set()
        group_by_fields = set(config.get("groupByFields", []))

        for i, agg in enumerate(aggregations):
            if not isinstance(agg, dict):
                errors.append(f"Aggregation at index {i} must be an object")
                continue

            field = agg.get("field")
            operation = agg.get("operation")
            output_name = agg.get("outputName", "")

            if not field:
                errors.append(f"Aggregation at index {i} is missing 'field'")
                continue

            if not operation:
                errors.append(f"Aggregation at index {i} is missing 'operation'")
                continue

            if operation not in AGGREGATION_OPERATIONS:
                errors.append(f"Unknown aggregation operation: '{operation}'")

            # Check for duplicate output names
            final_name = output_name.strip() if output_name and output_name.strip() else f"{field}_{operation}"
            if final_name in seen_output_names:
                errors.append(f"Duplicate output column name: '{final_name}'")
            if final_name in group_by_fields:
                errors.append(f"Output column '{final_name}' conflicts with group by field")
            seen_output_names.add(final_name)

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Summarize tool"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        lines = []
        
        group_by_fields = config.get("groupByFields", [])
        aggregations = config.get("aggregations", [])

        # Get input variable name
        input_var = input_vars.get("input", "df_input")

        # Generate output variable name
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        if not aggregations:
            lines.append(f"{var_name} = {input_var}")
            return (lines, {"output": var_name})

        # Build aggregation expressions as strings
        agg_expr_strs: list[str] = []
        
        for agg in aggregations:
            field = agg.get("field")
            operation = agg.get("operation", "Sum")
            output_name = agg.get("outputName", "")
            
            if not field:
                continue

            # Build the expression string
            expr_str = f"pl.col(\"{field}\")"
            
            # Apply the aggregation method
            method_map = {
                "Sum": ".sum()",
                "Mean": ".mean()",
                "Median": ".median()",
                "Min": ".min()",
                "Max": ".max()",
                "Std": ".std()",
                "Var": ".var()",
                "Count": ".count()",
                "CountDistinct": ".n_unique()",
                "First": ".first()",
                "Last": ".last()",
                "Concat": ".str.concat(\", \")",
            }
            
            expr_str += method_map.get(operation, ".sum()")

            # Apply output name alias
            if output_name and output_name.strip():
                expr_str += f".alias(\"{output_name.strip()}\")"
            else:
                expr_str += f".alias(\"{field}_{operation}\")"

            agg_expr_strs.append(expr_str)

        # Generate the code
        if group_by_fields:
            group_by_str = ", ".join(f'"{f}"' for f in group_by_fields)
            lines.append(f"{var_name} = {input_var}.group_by([{group_by_str}]).agg([")
        else:
            lines.append(f"{var_name} = {input_var}.select([")
        
        for i, expr_str in enumerate(agg_expr_strs):
            comma = "," if i < len(agg_expr_strs) - 1 else ""
            lines.append(f"    {expr_str}{comma}")
        
        lines.append("])")

        return (lines, {"output": var_name})
