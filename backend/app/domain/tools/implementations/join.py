"""Join tool - combines two datasets based on key columns."""

from typing import Any

import polars as pl

from app.api.models.common import ColumnSchema, DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import JoinOperation
from app.domain.tools.registry import register_tool


@register_tool("Join")
class JoinTool(BaseTool):
    """
    Joins two input datasets on specified key columns.

    Inputs:
        input-left: Left dataset
        input-right: Right dataset

    Outputs:
        output-left: Unmatched rows from left (anti-join)
        output-match: Matched/joined rows (inner join)
        output-right: Unmatched rows from right (anti-join)

    Config:
        joinType: 'inner' | 'left' | 'right' | 'outer'
        leftKeys: list of column names from left input
        rightKeys: list of column names from right input
        leftSuffix: suffix for left columns on conflict (default: '_left')
        rightSuffix: suffix for right columns on conflict (default: '_right')
    """

    def _build_operation(self, config: dict[str, Any]) -> JoinOperation:
        """Build the join operation from config."""
        return JoinOperation(
            left_keys=config.get("leftKeys", []),
            right_keys=config.get("rightKeys", []),
            right_suffix=config.get("rightSuffix", "_right"),
        )

    async def execute(
        self,
        config: dict[str, Any],
        inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]],
    ) -> dict[str, pl.LazyFrame]:
        left_input = inputs.get("input-left")
        right_input = inputs.get("input-right")

        # Normalize inputs (might be list from multi-input socket, take first)
        left_lf = self._normalize_input(left_input)
        right_lf = self._normalize_input(right_input)

        op = self._build_operation(config)
        unmatched_left, matched, unmatched_right = op.execute(left_lf, right_lf)

        return {
            "output-left": unmatched_left,
            "output-match": matched,
            "output-right": unmatched_right,
        }

    def _normalize_input(
        self, input_data: pl.LazyFrame | list[pl.LazyFrame] | None
    ) -> pl.LazyFrame | None:
        """Normalize input to single LazyFrame."""
        if input_data is None:
            return None
        if isinstance(input_data, list):
            return input_data[0] if input_data else None
        return input_data

    async def get_output_schema(
        self,
        config: dict[str, Any],
        input_schemas: dict[str, DataSchema | list[DataSchema]],
    ) -> dict[str, DataSchema]:
        left_schema = self._normalize_schema(input_schemas.get("input-left"))
        right_schema = self._normalize_schema(input_schemas.get("input-right"))

        # Handle missing schemas
        empty_schema = DataSchema(columns=[])
        if left_schema is None and right_schema is None:
            return {
                "output-left": empty_schema,
                "output-match": empty_schema,
                "output-right": empty_schema,
            }

        if left_schema is None:
            return {
                "output-left": empty_schema,
                "output-match": empty_schema,
                "output-right": right_schema or empty_schema,
            }

        if right_schema is None:
            return {
                "output-left": left_schema,
                "output-match": empty_schema,
                "output-right": empty_schema,
            }

        # Get config
        left_keys = config.get("leftKeys", [])
        right_keys = config.get("rightKeys", [])
        right_suffix = config.get("rightSuffix", "_right")

        # If no keys, no match possible
        if not left_keys or not right_keys:
            return {
                "output-left": left_schema,
                "output-match": empty_schema,
                "output-right": right_schema,
            }

        # Build matched schema: left columns + right non-key columns (with suffix if needed)
        left_col_names = {col.name for col in left_schema.columns}
        matched_columns = list(left_schema.columns)

        for col in right_schema.columns:
            # Skip right key columns if they match left key columns
            if col.name in right_keys:
                continue

            # Add suffix if name conflicts with left column
            if col.name in left_col_names:
                new_col = ColumnSchema(
                    name=col.name + right_suffix,
                    dtype=col.dtype,
                    nullable=col.nullable,
                )
                matched_columns.append(new_col)
            else:
                matched_columns.append(col)

        return {
            "output-left": left_schema,
            "output-match": DataSchema(columns=matched_columns),
            "output-right": right_schema,
        }

    def _normalize_schema(
        self, schema: DataSchema | list[DataSchema] | None
    ) -> DataSchema | None:
        """Normalize schema to single DataSchema."""
        if schema is None:
            return None
        if isinstance(schema, list):
            return schema[0] if schema else None
        return schema

    async def validate_config(
        self,
        config: dict[str, Any],
        input_schemas: dict[str, DataSchema | list[DataSchema]] | None = None,
    ) -> list[str]:
        errors = []

        left_keys = config.get("leftKeys", [])
        right_keys = config.get("rightKeys", [])

        # Keys must have same length if both specified
        if left_keys and right_keys and len(left_keys) != len(right_keys):
            errors.append(
                f"Left keys ({len(left_keys)}) and right keys ({len(right_keys)}) "
                "must have the same number of columns"
            )

        # Validate join type
        join_type = config.get("joinType", "inner")
        valid_types = {"inner", "left", "right", "outer"}
        if join_type not in valid_types:
            errors.append(
                f"Invalid join type '{join_type}'. Must be one of: {', '.join(valid_types)}"
            )

        # Validate key columns exist in schemas if provided
        if input_schemas:
            left_schema = self._normalize_schema(input_schemas.get("input-left"))
            right_schema = self._normalize_schema(input_schemas.get("input-right"))

            if left_schema and left_keys:
                left_col_names = {col.name for col in left_schema.columns}
                for key in left_keys:
                    if key not in left_col_names:
                        errors.append(f"Left key column '{key}' not found in left input")

            if right_schema and right_keys:
                right_col_names = {col.name for col in right_schema.columns}
                for key in right_keys:
                    if key not in right_col_names:
                        errors.append(f"Right key column '{key}' not found in right input")

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Join tool - uses same operation as execute()"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        # Get input variables - join can have optional inputs
        left_var = self._get_optional_input_var(input_vars.get("input-left"))
        right_var = self._get_optional_input_var(input_vars.get("input-right"))

        # Generate output variable names
        base_name = PythonCodeGenerator.sanitize_var_name(tool_id)
        left_out_var = f"df_{base_name}_unmatched_left"
        match_out_var = f"df_{base_name}_matched"
        right_out_var = f"df_{base_name}_unmatched_right"

        # Use the same operation builder as execute()
        op = self._build_operation(config)
        lines = op.to_code(left_var, right_var, left_out_var, match_out_var, right_out_var)

        return (
            lines,
            {
                "output-left": left_out_var,
                "output-match": match_out_var,
                "output-right": right_out_var,
            },
        )

    def _get_optional_input_var(self, var: str | list[str] | None) -> str | None:
        """Get single variable from input, returning None if not provided."""
        if var is None:
            return None
        if isinstance(var, list):
            return var[0] if var else None
        return var
