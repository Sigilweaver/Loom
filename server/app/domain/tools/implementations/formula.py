"""Formula tool implementation - Add or replace calculated columns.

Supports multi-operation mode: a single Formula node can define multiple
column operations that are applied sequentially.  This allows operation N
to reference columns created by operation N-1.

Backward compatible: legacy configs with top-level ``column_name`` /
``expression`` are transparently wrapped into a single-item operations list.
"""

from typing import Any

import polars as pl
import structlog

from app.api.models.common import ColumnSchema, DataSchema, PolarsDataType
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import FormulaOperation
from app.domain.tools.registry import register_tool
from app.domain.tools.sockets import CommonSockets
from app.utils.errors import ToolError
from app.utils.expression import parse_polars_expression

log = structlog.get_logger()


def _infer_dtype_from_expression(expr_str: str, input_schema: DataSchema) -> PolarsDataType:
    """Attempt to infer the output data type of a Polars expression.

    Strategy:
    1. Build a zero-row LazyFrame with the correct input schema.
    2. Evaluate the expression against it via `with_columns` and read
       the resulting dtype from Polars' own type inference engine.
    3. Fall back to STRING on any failure (non-blocking, best-effort).
    """
    try:
        # Build a schema dict for a zero-row frame
        dtype_map: dict[str, type] = {
            "Int8": pl.Int8, "Int16": pl.Int16, "Int32": pl.Int32, "Int64": pl.Int64,
            "UInt8": pl.UInt8, "UInt16": pl.UInt16, "UInt32": pl.UInt32, "UInt64": pl.UInt64,
            "Float32": pl.Float32, "Float64": pl.Float64,
            "Boolean": pl.Boolean, "String": pl.String, "Utf8": pl.String,
            "Date": pl.Date, "Datetime": pl.Datetime, "Time": pl.Time,
            "Duration": pl.Duration, "Categorical": pl.Categorical,
            "Decimal": pl.Decimal,
        }
        schema: dict[str, type] = {}
        for col in input_schema.columns:
            pl_type = dtype_map.get(col.dtype.value, pl.String)
            schema[col.name] = pl_type

        zf = pl.LazyFrame(schema=schema)
        expr = parse_polars_expression(expr_str)
        result_schema = zf.with_columns(expr.alias("__infer__")).collect_schema()
        inferred = result_schema["__infer__"]

        # Map back to PolarsDataType enum
        polars_to_enum: dict[str, PolarsDataType] = {
            "Int8": PolarsDataType.INT8, "Int16": PolarsDataType.INT16,
            "Int32": PolarsDataType.INT32, "Int64": PolarsDataType.INT64,
            "UInt8": PolarsDataType.UINT8, "UInt16": PolarsDataType.UINT16,
            "UInt32": PolarsDataType.UINT32, "UInt64": PolarsDataType.UINT64,
            "Float32": PolarsDataType.FLOAT32, "Float64": PolarsDataType.FLOAT64,
            "Boolean": PolarsDataType.BOOLEAN,
            "String": PolarsDataType.STRING, "Utf8": PolarsDataType.UTF8,
            "Date": PolarsDataType.DATE, "Datetime": PolarsDataType.DATETIME,
            "Time": PolarsDataType.TIME, "Duration": PolarsDataType.DURATION,
            "Categorical": PolarsDataType.CATEGORICAL,
        }
        base_name = str(inferred.base_type()) if hasattr(inferred, "base_type") else str(inferred)
        # Clean up the string representation (e.g. "Datetime(time_unit='us'...)" -> "Datetime")
        for key, val in polars_to_enum.items():
            if base_name.startswith(key):
                return val
        return PolarsDataType.STRING
    except Exception:
        return PolarsDataType.STRING


def _normalize_operations(config: dict[str, Any]) -> list[dict[str, str]]:
    """Extract the list of operations from config.

    Handles:
    - New format: ``{"operations": [{"column_name": ..., "expression": ...}, ...]}``
    - Legacy format: ``{"column_name": ..., "expression": ...}``
    """
    ops = config.get("operations")
    if isinstance(ops, list) and len(ops) > 0:
        return [
            {
                "column_name": str(
                    op.get("column_name") or op.get("columnName") or ""
                ),
                "expression": str(op.get("expression", "")),
            }
            for op in ops
            if isinstance(op, dict)
        ]

    # Legacy single-operation format
    column_name = config.get("column_name", "")
    expression = config.get("expression", "")
    if column_name or expression:
        return [{"column_name": str(column_name), "expression": str(expression)}]

    return []


@register_tool("Formula")
class FormulaTool(BaseTool):
    """
    Add or replace calculated columns using Polars expressions.

    Supports multiple operations in a single node — each operation is
    applied sequentially so later operations can reference columns
    created by earlier ones.

    Users interact through a GUI builder (Basic mode) or write Polars
    expressions directly (Advanced mode).  The GUI generates expressions
    automatically.

    Config (new multi-operation format):
    - operations: list of {column_name: str, expression: str}

    Config (legacy single-operation format, still supported):
    - column_name: Name of the column to create or replace
    - expression: Polars expression string
    """

    def _build_operations(self, config: dict[str, Any]) -> list[FormulaOperation]:
        """Build formula operations from config (handles legacy + new format)."""
        raw_ops = _normalize_operations(config)
        return [
            FormulaOperation(column_name=op["column_name"], expr_str=op["expression"])
            for op in raw_ops
        ]

    # Keep legacy helper for backward compat with tests
    def _build_operation(self, config: dict[str, Any]) -> FormulaOperation:
        """Build a single formula operation from config (legacy)."""
        return FormulaOperation(
            column_name=config.get("column_name", ""),
            expr_str=config.get("expression", ""),
        )

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """
        Apply one or more formula operations sequentially.

        Operations are chained: operation N can reference columns
        created by operation N-1.
        """
        if CommonSockets.INPUT not in inputs:
            raise ToolError("Formula tool requires input on socket 'input'")

        input_data = inputs[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Formula tool does not support multiple inputs")
        lf: pl.LazyFrame = input_data

        ops = self._build_operations(config)
        if not ops:
            raise ToolError("Formula tool requires at least one operation")

        for i, op in enumerate(ops):
            if not op.column_name:
                raise ToolError(f"Operation {i + 1}: missing column name")
            if not op.expr_str:
                raise ToolError(f"Operation {i + 1}: missing expression")
            lf = op.execute(lf)

        return {CommonSockets.OUTPUT: lf}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Calculate output schema by accumulating all operations.

        Uses Polars' own type inference (zero-row frame) to determine
        accurate output dtypes rather than defaulting to STRING.
        """
        if CommonSockets.INPUT not in input_schemas:
            raise ToolError("Formula tool requires input schema on socket 'input'")

        input_data = input_schemas[CommonSockets.INPUT]
        if isinstance(input_data, list):
            raise ToolError("Formula tool does not support multiple input schemas")
        input_schema: DataSchema = input_data

        ops = _normalize_operations(config)
        if not ops:
            raise ToolError("Formula tool requires at least one operation")

        # Accumulate schema changes across all operations
        current_schema = input_schema
        for op in ops:
            column_name = op["column_name"]
            expression = op["expression"]
            if not column_name:
                continue

            # Infer type from expression
            inferred_dtype = _infer_dtype_from_expression(expression, current_schema) if expression else PolarsDataType.STRING

            new_column = ColumnSchema(
                name=column_name,
                dtype=inferred_dtype,
                nullable=True,
                description=f"Calculated: {expression}",
            )

            existing_column_names = [col.name for col in current_schema.columns]
            column_exists = column_name in existing_column_names

            if column_exists:
                output_columns = [
                    new_column if col.name == column_name else col
                    for col in current_schema.columns
                ]
            else:
                output_columns = list(current_schema.columns)
                output_columns.append(new_column)

            current_schema = DataSchema(
                columns=output_columns,
                row_count=current_schema.row_count,
                file_size_bytes=None,
            )

        return {CommonSockets.OUTPUT: current_schema}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate formula configuration.

        Checks presence of required fields AND attempts to parse
        each expression to catch syntax errors early.
        """
        errors: list[str] = []

        ops = _normalize_operations(config)
        if not ops:
            # Legacy validation for backward compat
            if "column_name" not in config or not config.get("column_name"):
                errors.append("Missing required field: column_name")
            elif not isinstance(config["column_name"], str):
                errors.append("column_name must be a string")
            if "expression" not in config:
                errors.append("Missing required field: expression")
            elif not isinstance(config["expression"], str):
                errors.append("expression must be a string")
            return errors

        for i, op in enumerate(ops):
            prefix = f"Operation {i + 1}: " if len(ops) > 1 else ""
            col_name = op["column_name"]
            expression = op["expression"]

            if not col_name:
                errors.append(f"{prefix}Missing required field: column_name")
            if not expression:
                errors.append(f"{prefix}Missing required field: expression")
            elif isinstance(expression, str) and expression.strip():
                # Attempt to parse the expression to catch syntax errors
                try:
                    parse_polars_expression(expression)
                except ToolError as e:
                    errors.append(f"{prefix}Invalid expression: {e}")

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Formula tool.

        For multi-operation configs, chains with_columns calls using
        intermediate variables.
        """
        from app.domain.workflow.code_generator import PythonCodeGenerator

        input_var = self._get_input_var(input_vars.get(CommonSockets.INPUT))
        base_var = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        ops = self._build_operations(config)
        if not ops:
            return ([f"{base_var} = {input_var}"], {CommonSockets.OUTPUT: base_var})

        if len(ops) == 1:
            lines = ops[0].to_code(input_var, base_var)
            return (lines, {CommonSockets.OUTPUT: base_var})

        # Multi-operation: chain intermediate variables
        all_lines: list[str] = []
        current_var = input_var
        for i, op in enumerate(ops):
            is_last = i == len(ops) - 1
            out_var = base_var if is_last else f"{base_var}_step{i + 1}"
            all_lines.extend(op.to_code(current_var, out_var))
            current_var = out_var

        return (all_lines, {CommonSockets.OUTPUT: base_var})

