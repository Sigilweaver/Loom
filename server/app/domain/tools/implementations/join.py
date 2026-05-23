"""Join tool - combines two datasets based on key columns."""

from typing import Any, Literal

import polars as pl
from pydantic import BaseModel, ConfigDict, Field

from app.api.models.common import ColumnSchema, DataSchema
from app.domain.execution.safety import check_cross_join_safety, raise_if_unsafe
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import JoinOperation
from app.domain.tools.registry import register_tool
from app.domain.tools.sockets import JoinSockets
from app.utils.columns import resolve_column_names


class JoinToolConfig(BaseModel):
    """WP-19 typed config for Join."""

    model_config = ConfigDict(extra="allow")

    leftKeys: list[str] = Field(default_factory=list)
    rightKeys: list[str] = Field(default_factory=list)
    joinType: Literal["inner", "left", "right", "outer"] = "inner"
    leftSuffix: str = "_left"
    rightSuffix: str = "_right"


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

    def is_blocking(self, config: dict[str, Any] | None = None) -> bool:
        """Join is blocking - must scan both sides for matches."""
        return True

    @classmethod
    def config_model(cls) -> type[JoinToolConfig]:
        return JoinToolConfig

    def cache_keys(self, config: dict[str, Any]) -> dict[str, Any]:
        return {
            "leftKeys": config.get("leftKeys", []),
            "rightKeys": config.get("rightKeys", []),
            "joinType": config.get("joinType", "inner"),
            "leftSuffix": config.get("leftSuffix", "_left"),
            "rightSuffix": config.get("rightSuffix", "_right"),
        }

    def _build_operation(self, config: dict[str, Any]) -> JoinOperation:
        """Build the join operation from config."""
        return JoinOperation(
            left_keys=config.get("leftKeys", []),
            right_keys=config.get("rightKeys", []),
            right_suffix=config.get("rightSuffix", "_right"),
            join_type=config.get("joinType", "inner"),
        )

    async def execute(
        self,
        config: dict[str, Any],
        inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]],
    ) -> dict[str, pl.LazyFrame]:
        left_input = inputs.get(JoinSockets.INPUT_LEFT)
        right_input = inputs.get(JoinSockets.INPUT_RIGHT)

        # Normalize inputs (might be list from multi-input socket, take first)
        left_lf = self._normalize_input(left_input)
        right_lf = self._normalize_input(right_input)

        # Resolve column name casing against actual schemas
        left_keys = config.get("leftKeys", [])
        right_keys = config.get("rightKeys", [])
        resolved_config = config
        if left_keys and left_lf is not None:
            available_left = left_lf.collect_schema().names()
            resolved_left = resolve_column_names(left_keys, available_left, context="Join leftKeys")
            if resolved_left != left_keys:
                resolved_config = {**resolved_config, "leftKeys": resolved_left}
                left_keys = resolved_left
        if right_keys and right_lf is not None:
            available_right = right_lf.collect_schema().names()
            resolved_right = resolve_column_names(
                right_keys, available_right, context="Join rightKeys"
            )
            if resolved_right != right_keys:
                resolved_config = {**resolved_config, "rightKeys": resolved_right}
                right_keys = resolved_right

        # Safety check: prevent cross join row explosion
        is_cross_join = not left_keys or not right_keys
        if is_cross_join and left_lf is not None and right_lf is not None:
            raise_if_unsafe(check_cross_join_safety(left_lf, right_lf))

        op = self._build_operation(resolved_config)
        unmatched_left, matched, unmatched_right = op.execute(left_lf, right_lf)

        return {
            JoinSockets.OUTPUT_LEFT: unmatched_left,
            JoinSockets.OUTPUT_MATCH: matched,
            JoinSockets.OUTPUT_RIGHT: unmatched_right,
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
        left_schema = self._normalize_schema(input_schemas.get(JoinSockets.INPUT_LEFT))
        right_schema = self._normalize_schema(input_schemas.get(JoinSockets.INPUT_RIGHT))

        # Handle missing schemas
        empty_schema = DataSchema(columns=[])
        if left_schema is None and right_schema is None:
            return {
                JoinSockets.OUTPUT_LEFT: empty_schema,
                JoinSockets.OUTPUT_MATCH: empty_schema,
                JoinSockets.OUTPUT_RIGHT: empty_schema,
            }

        if left_schema is None:
            return {
                JoinSockets.OUTPUT_LEFT: empty_schema,
                JoinSockets.OUTPUT_MATCH: empty_schema,
                JoinSockets.OUTPUT_RIGHT: right_schema or empty_schema,
            }

        if right_schema is None:
            return {
                JoinSockets.OUTPUT_LEFT: left_schema,
                JoinSockets.OUTPUT_MATCH: empty_schema,
                JoinSockets.OUTPUT_RIGHT: empty_schema,
            }

        # Get config
        left_keys = config.get("leftKeys", [])
        right_keys = config.get("rightKeys", [])
        right_suffix = config.get("rightSuffix", "_right")
        join_type = config.get("joinType", "inner")

        # Cross join: all columns from both sides (with suffix for conflicts)
        # This happens when no keys are specified OR joinType is explicitly "cross"
        is_cross_join = join_type == "cross" or (not left_keys or not right_keys)
        if is_cross_join:
            # Build cross join schema: all left columns + all right columns (with suffix if needed)
            left_col_names = {col.name for col in left_schema.columns}
            cross_columns = list(left_schema.columns)
            for col in right_schema.columns:
                if col.name in left_col_names:
                    new_col = ColumnSchema(
                        name=col.name + right_suffix,
                        dtype=col.dtype,
                        nullable=col.nullable,
                    )
                    cross_columns.append(new_col)
                else:
                    cross_columns.append(col)
            return {
                JoinSockets.OUTPUT_LEFT: empty_schema,
                JoinSockets.OUTPUT_MATCH: DataSchema(columns=cross_columns),
                JoinSockets.OUTPUT_RIGHT: empty_schema,
            }

        # Build matched schema: left columns + right non-key columns (with suffix if needed)
        left_col_names = {col.name for col in left_schema.columns}
        matched_columns = list(left_schema.columns)

        for col in right_schema.columns:
            # Skip right key columns if they match left key columns
            if col.name in right_keys:
                continue

            # For left/outer joins, right columns become nullable (unmatched rows have nulls)
            is_nullable = col.nullable or join_type in ("left", "outer")

            # Add suffix if name conflicts with left column
            if col.name in left_col_names:
                new_col = ColumnSchema(
                    name=col.name + right_suffix,
                    dtype=col.dtype,
                    nullable=is_nullable,
                )
                matched_columns.append(new_col)
            else:
                if is_nullable != col.nullable:
                    matched_columns.append(
                        ColumnSchema(name=col.name, dtype=col.dtype, nullable=is_nullable)
                    )
                else:
                    matched_columns.append(col)

        # For right/outer joins, left columns become nullable too
        if join_type in ("right", "outer"):
            matched_columns = [
                ColumnSchema(name=c.name, dtype=c.dtype, nullable=True) for c in matched_columns
            ]

        # For left/outer joins, unmatched_left is empty (included in matched)
        output_left = empty_schema if join_type in ("left", "outer") else left_schema
        # For right/outer joins, unmatched_right is empty (included in matched)
        output_right = empty_schema if join_type in ("right", "outer") else right_schema

        return {
            JoinSockets.OUTPUT_LEFT: output_left,
            JoinSockets.OUTPUT_MATCH: DataSchema(columns=matched_columns),
            JoinSockets.OUTPUT_RIGHT: output_right,
        }

    def _normalize_schema(self, schema: DataSchema | list[DataSchema] | None) -> DataSchema | None:
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
        valid_types = {"inner", "left", "right", "outer", "cross"}
        if join_type not in valid_types:
            errors.append(
                f"Invalid join type '{join_type}'. Must be one of: {', '.join(valid_types)}"
            )

        # Validate key columns exist in schemas if provided
        if input_schemas:
            left_schema = self._normalize_schema(input_schemas.get(JoinSockets.INPUT_LEFT))
            right_schema = self._normalize_schema(input_schemas.get(JoinSockets.INPUT_RIGHT))

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
        left_var = self._get_optional_input_var(input_vars.get(JoinSockets.INPUT_LEFT))
        right_var = self._get_optional_input_var(input_vars.get(JoinSockets.INPUT_RIGHT))

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
                JoinSockets.OUTPUT_LEFT: left_out_var,
                JoinSockets.OUTPUT_MATCH: match_out_var,
                JoinSockets.OUTPUT_RIGHT: right_out_var,
            },
        )

    def _get_optional_input_var(self, var: str | list[str] | None) -> str | None:
        """Get single variable from input, returning None if not provided."""
        if var is None:
            return None
        if isinstance(var, list):
            return var[0] if var else None
        return var
