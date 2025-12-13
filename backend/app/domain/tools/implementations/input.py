"""Input tool implementation - Load data from files"""

from typing import Any

import polars as pl

from app.api.models.common import DataSchema
from app.domain.datasources.factory import DataSourceFactory
from app.domain.tools.base import BaseTool
from app.domain.tools.loaders.factory import LoaderFactory
from app.domain.tools.registry import register_tool
from app.utils.errors import ToolError


@register_tool("Input")
class InputTool(BaseTool):
    """
    Load data from various file sources (CSV, Parquet, etc.)

    Uses the LoaderFactory to delegate loading to format-specific loaders.
    Always returns LazyFrame for efficient lazy evaluation.
    """

    async def execute(
        self, config: dict[str, Any], inputs: dict[str, pl.LazyFrame | list[pl.LazyFrame]]
    ) -> dict[str, pl.LazyFrame]:
        """
        Load data from file source.

        Config should contain:
        - category: "file"
        - type: "csv" | "parquet" | etc.
        - csvMode: "scan" | "read" | "batched" (for CSV)
        - parquetMode: "scan" | "read" (for Parquet)
        - source: file path
        - ... other source-specific config
        """
        # Input tools have no inputs
        if inputs:
            raise ToolError("Input tool should not have inputs")

        # Get source type
        source_type = config.get("type")
        if not source_type:
            raise ToolError("Input tool config missing 'type' field")

        # Use LoaderFactory to get appropriate loader and load data
        loader = LoaderFactory.create(source_type)
        lf = await loader.load(config)

        # Return on output socket
        return {"output": lf}

    async def get_output_schema(
        self, config: dict[str, Any], input_schemas: dict[str, DataSchema | list[DataSchema]]
    ) -> dict[str, DataSchema]:
        """
        Get schema by inspecting the data source.

        Uses the datasource inspect endpoint to get schema without loading data.
        """
        source_type = config.get("type")
        if not source_type:
            raise ToolError("Input tool config missing 'type' field")

        # Use datasource factory to inspect
        datasource = DataSourceFactory.create(source_type)
        source_path = config.get("source")

        if not source_path:
            raise ToolError("Input tool config missing 'source' field")

        # Inspect to get schema
        schema = await datasource.inspect(source_path, config)

        return {"output": schema}

    async def validate_config(self, config: dict[str, Any]) -> list[str]:
        """Validate input tool configuration"""
        errors = []

        if "type" not in config:
            errors.append("Missing required field: type")

        if "source" not in config:
            errors.append("Missing required field: source")

        # Validate source type
        source_type = config.get("type")
        if source_type and not LoaderFactory.is_supported(source_type):
            supported = ", ".join(LoaderFactory.list_supported_types())
            errors.append(f"Unsupported source type: {source_type}. Supported: {supported}")

        return errors

    def to_python_code(
        self,
        tool_id: str,
        config: dict[str, Any],
        input_vars: dict[str, str | list[str]],
    ) -> tuple[list[str], dict[str, str]]:
        """Generate Python code for Input tool"""
        from app.domain.workflow.code_generator import PythonCodeGenerator

        source_type = config.get("type", "csv")
        source_path = config.get("source", "")

        var_name = f"df_{PythonCodeGenerator.sanitize_var_name(tool_id)}"

        if not source_path:
            lines = [f"{var_name} = None  # ERROR: No source file specified"]
            return (lines, {"output": var_name})

        # Use loader to generate code
        if LoaderFactory.is_supported(source_type):
            loader = LoaderFactory.create(source_type)
            lines = loader.to_python_code(var_name, config)
        else:
            lines = [f"# TODO: {source_type} input not yet supported in code generation"]

        return (lines, {"output": var_name})
