from typing import Any

import polars as pl
from pydantic import BaseModel, ConfigDict, Field

from app.domain.models.common import DataSchema
from app.domain.tools.base import BaseTool
from app.domain.tools.expr_builder import UnionOperation
from app.domain.tools.registry import register_tool
from app.domain.tools.sockets import UnionSockets


class UnionToolConfig(BaseModel):
    """Typed config for Union."""

    model_config = ConfigDict(extra="allow")

    mode: str = Field(default="ByName")


@register_tool("Union")
class UnionTool(BaseTool):
    @classmethod
    def config_model(cls) -> type[UnionToolConfig]:
        return UnionToolConfig

    def cache_keys(self, config: dict[str, Any]) -> dict[str, Any]:
        return {"mode": config.get("mode", "ByName")}

    def _build_operation(self, config: dict[str, Any]) -> UnionOperation:
        """Build the union operation from config."""
        return UnionOperation(mode=config.get("mode", "ByName"))

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        # Get inputs from socket 'input'
        input_data = inputs.get(UnionSockets.INPUT)

        # Ensure we have a list of frames
        frames: list[pl.LazyFrame] = []
        if input_data is None:
            frames = []
        elif isinstance(input_data, list):
            frames = input_data
        else:
            frames = [input_data]

        op = self._build_operation(config)
        result = op.execute(frames)

        return {UnionSockets.OUTPUT: result}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        input_schema_data = input_schemas.get(UnionSockets.INPUT)

        if not input_schema_data:
            return {UnionSockets.OUTPUT: DataSchema(columns=[])}

        schemas: list[DataSchema] = []
        if isinstance(input_schema_data, list):
            schemas = input_schema_data
        else:
            schemas = [input_schema_data]

        if not schemas:
            return {UnionSockets.OUTPUT: DataSchema(columns=[])}

        mode = config.get("mode", "ByName")

        if mode == "ByName":
            # Union of all columns
            # Use a dict to track unique columns by name
            # If type conflict, what happens? Polars diagonal concat usually upcasts.
            # For schema prediction, we might just take the first one or try to merge.
            # Let's merge all unique columns.

            merged_columns = {}
            for schema in schemas:
                for col in schema.columns:
                    if col.name not in merged_columns:
                        merged_columns[col.name] = col
                    # TODO: Handle type merging if needed

            return {UnionSockets.OUTPUT: DataSchema(columns=list(merged_columns.values()))}

        elif mode == "ByPosition":
            # Output schema matches the first input
            return {UnionSockets.OUTPUT: schemas[0]}

        return {UnionSockets.OUTPUT: schemas[0]}

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Union tool - uses same operation as execute()"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        # Get input variable(s) - can be a single var or list
        input_data = input_vars.get(UnionSockets.INPUT)
        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        # Normalize to list
        if input_data is None:
            input_list: list[str] = []
        elif isinstance(input_data, str):
            input_list = [input_data]
        else:
            input_list = input_data

        # Use the same operation builder as execute()
        op = self._build_operation(config)
        lines = op.to_code(input_list, var_name)

        return (lines, {UnionSockets.OUTPUT: var_name})
